import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  noticesEnabled,
  validSchool,
  validUuid,
  noticeTransaction,
} from "@/src/modules/communications/service";
export function inappEnabled() {
  noticesEnabled();
  if (process.env.PHASE10_INAPP_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
export interface InboxItem {
  id: string;
  createdAt: Date;
  action: "READ" | "UNREAD";
  releaseId: string;
}
export async function readInbox(s: string, cursor?: string, limit = 50) {
  inappEnabled();
  validSchool(s);
  if (cursor !== undefined) validUuid(cursor);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new NoticeError("INVALID_INPUT");
  const u = await noticeActor();
  const enter = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (phase10_recipient(${s},${u},'STAFF_ONLY') OR phase10_recipient(${s},${u},'STUDENTS_AND_GUARDIANS')) AS allowed`;
  if (!enter[0]?.allowed) throw new NoticeError("NOT_FOUND");
  if (cursor) {
    const visible = await prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT d."id" FROM "NotificationDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=${u} WHERE d."schoolId"=${s} AND d."id"=${cursor}::uuid AND can_read_notice(d."schoolId",d."releaseId",${u}) AND NOT EXISTS(SELECT 1 FROM "NotificationSuppression" x WHERE x."deliveryId"=d."id")`;
    if (!visible.length) throw new NoticeError("NOT_FOUND");
  }
  const common = Prisma.sql`FROM "NotificationDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=${u} LEFT JOIN LATERAL(SELECT x."action" FROM "NotificationInteraction" x WHERE x."schoolId"=d."schoolId" AND x."deliveryId"=d."id" ORDER BY x."ordinal" DESC LIMIT 1) interaction ON true WHERE d."schoolId"=${s} AND can_read_notice(d."schoolId",d."releaseId",${u}) AND NOT EXISTS(SELECT 1 FROM "NotificationSuppression" x WHERE x."deliveryId"=d."id")`;
  const items = await prisma.$queryRaw<InboxItem[]>(
    Prisma.sql`SELECT d."id",d."createdAt",d."releaseId",COALESCE(interaction."action",'UNREAD') AS action ${common} ${cursor ? Prisma.sql`AND (d."createdAt",d."id")<(SELECT c."createdAt",c."id" FROM "NotificationDelivery" c WHERE c."schoolId"=${s} AND c."id"=${cursor}::uuid)` : Prisma.empty} ORDER BY d."createdAt" DESC,d."id" DESC LIMIT ${limit + 1}`,
  );
  const unread = await prisma.$queryRaw<Array<{ count: string }>>(
    Prisma.sql`SELECT COUNT(*)::text AS count ${common} AND COALESCE(interaction."action",'UNREAD')='UNREAD'`,
  );
  const more = items.length > limit;
  if (more) items.pop();
  return {
    items: items.map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      read: i.action === "READ",
      text: "A school notice is available",
      href: `/schools/${encodeURIComponent(s)}/notices/${i.releaseId}`,
    })),
    nextCursor: more ? items[items.length - 1].id : null,
    unreadCount: unread[0]?.count ?? "0",
  };
}
const interactionInput = z
  .object({ action: z.enum(["READ", "UNREAD"]), requestKey: z.string().uuid() })
  .strict();
export async function changeNotification(
  s: string,
  id: string,
  input: unknown,
) {
  inappEnabled();
  validSchool(s);
  validUuid(id);
  const p = interactionInput.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    const allowed = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT delivery."id" FROM "NotificationDelivery" delivery JOIN "Membership" m ON m."schoolId"=delivery."schoolId" AND m."id"=delivery."recipientMembershipId" AND m."userId"=${u} WHERE delivery."schoolId"=${s} AND delivery."id"=${id}::uuid AND can_read_notice(delivery."schoolId",delivery."releaseId",${u}) AND NOT EXISTS(SELECT 1 FROM "NotificationSuppression" x WHERE x."deliveryId"=delivery."id") FOR UPDATE OF delivery`;
    if (!allowed.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.notificationInteraction.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.deliveryId !== id ||
        old.actorUserId !== u ||
        old.action !== d.action
      )
        throw new NoticeError("CONFLICT");
      return { id, read: d.action === "READ", replay: true };
    }
    await tx.notificationInteraction.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        deliveryId: id,
        actorUserId: u,
        action: d.action,
        requestKey: d.requestKey,
        ordinal: 0,
      },
    });
    return { id, read: d.action === "READ", replay: false };
  });
}
async function requireWorker(
  tx: Prisma.TransactionClient,
  s: string,
  u: string,
) {
  const allowed = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "User" WHERE "id"=${u} AND ("platformRole"='SUPER_ADMIN' OR phase10_owner(${s},${u})) FOR UPDATE`;
  if (!allowed.length) throw new NoticeError("NOT_FOUND");
}
interface Claim {
  eventId: string;
  schoolId: string;
  attempt: number;
  failures: number;
  cursorMembershipId: string | null;
  kind: string;
  releaseId: string;
  leaseToken: string;
}
export async function claimNoticeEvent(s: string, u: string) {
  inappEnabled();
  validSchool(s);
  return noticeTransaction(async (tx) => {
    await requireWorker(tx, s, u);
    const candidates = await tx.$queryRaw<
      Array<{
        eventId: string;
        state: string;
        attempt: number;
        failures: number;
      }>
    >`SELECT d."eventId",d."state",d."attempt",d."failures" FROM "OutboxDispatch" d WHERE d."schoolId"=${s} AND d."nextAttemptAt"<=clock_timestamp() AND (d."state" IN ('PENDING','RETRY_WAIT') OR (d."state"='LEASED' AND d."leaseExpiresAt"<=clock_timestamp())) ORDER BY d."nextAttemptAt",d."eventId" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!candidates.length) return null;
    const old = candidates[0];
    if (old.state === "LEASED")
      await tx.outboxAttemptEvent.create({
        data: {
          id: randomUUID(),
          schoolId: s,
          eventId: old.eventId,
          operatorUserId: u,
          attempt: old.attempt,
          outcome: "LEASE_EXPIRED",
        },
      });
    if (old.state === "LEASED") {
      const failures = old.failures + 1;
      await tx.$executeRaw`UPDATE "OutboxDispatch" SET "failures"=${failures},"state"=${failures >= 5 ? "DEAD_LETTER" : "PENDING"},"leaseToken"=NULL,"leaseExpiresAt"=NULL WHERE "schoolId"=${s} AND "eventId"=${old.eventId}::uuid`;
      if (failures >= 5) {
        await tx.outboxAttemptEvent.create({
          data: {
            id: randomUUID(),
            schoolId: s,
            eventId: old.eventId,
            operatorUserId: u,
            attempt: old.attempt,
            outcome: "DEAD_LETTER",
          },
        });
        return null;
      }
    }
    const token = randomUUID();
    const claims = await tx.$queryRaw<
      Claim[]
    >`UPDATE "OutboxDispatch" d SET "state"='LEASED',"leaseToken"=${token}::uuid,"leaseExpiresAt"=clock_timestamp()+interval '30 seconds',"attempt"=d."attempt"+1 FROM "DomainEvent" e WHERE d."eventId"=${old.eventId}::uuid AND d."schoolId"=${s} AND e."id"=d."eventId" AND e."schoolId"=d."schoolId" RETURNING d."eventId",d."schoolId",d."attempt",d."failures",d."cursorMembershipId",e."kind",e."releaseId",d."leaseToken"`;
    const c = claims[0];
    await tx.outboxAttemptEvent.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        eventId: c.eventId,
        operatorUserId: u,
        attempt: c.attempt,
        outcome: "CLAIMED",
      },
    });
    return c;
  });
}
export async function processNoticeClaim(candidate: Claim, u: string) {
  inappEnabled();
  return noticeTransaction(async (tx) => {
    await requireWorker(tx, candidate.schoolId, u);
    const lease = await tx.$queryRaw<
      Claim[]
    >`SELECT q."eventId",q."schoolId",q."attempt",q."failures",q."cursorMembershipId",q."leaseToken",e."kind",e."releaseId" FROM "OutboxDispatch" q JOIN "DomainEvent" e ON e."schoolId"=q."schoolId" AND e."id"=q."eventId" WHERE q."schoolId"=${candidate.schoolId} AND q."eventId"=${candidate.eventId}::uuid AND q."state"='LEASED' AND q."leaseToken"=${candidate.leaseToken}::uuid AND q."leaseExpiresAt">clock_timestamp() FOR UPDATE OF q`;
    if (!lease.length) return { processed: false, delivered: 0 };
    const c = lease[0];
    const members =
      c.kind === "NOTICE_PUBLISHED"
        ? await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT m."id" FROM "Membership" m WHERE m."schoolId"=${c.schoolId} ${c.cursorMembershipId ? Prisma.sql`AND m."id">${c.cursorMembershipId}` : Prisma.empty} ORDER BY m."id" LIMIT 100`,
          )
        : [];
    let delivered = 0;
    for (const member of members)
      delivered +=
        await tx.$executeRaw`INSERT INTO "NotificationDelivery" ("id","schoolId","eventId","releaseId","recipientMembershipId") SELECT ${randomUUID()}::uuid,${c.schoolId},${c.eventId}::uuid,${c.releaseId}::uuid,m."id" FROM "Membership" m WHERE m."schoolId"=${c.schoolId} AND m."id"=${member.id} AND can_read_notice(${c.schoolId},${c.releaseId}::uuid,m."userId") AND EXISTS(SELECT 1 FROM "OutboxDispatch" q WHERE q."schoolId"=${c.schoolId} AND q."eventId"=${c.eventId}::uuid AND q."leaseToken"=${c.leaseToken}::uuid AND q."leaseExpiresAt">clock_timestamp()) ON CONFLICT ("schoolId","eventId","recipientMembershipId","contextKey") DO NOTHING`;
    const validLease = await tx.$queryRaw<
      Array<{ eventId: string }>
    >`SELECT "eventId" FROM "OutboxDispatch" WHERE "schoolId"=${c.schoolId} AND "eventId"=${c.eventId}::uuid AND "leaseToken"=${c.leaseToken}::uuid AND "leaseExpiresAt">clock_timestamp()`;
    if (!validLease.length) throw new NoticeError("CONFLICT");
    const more = members.length === 100;
    await tx.$executeRaw`UPDATE "OutboxDispatch" SET "state"=${more ? "PENDING" : "DONE"},"cursorMembershipId"=${members.length ? members[members.length - 1].id : c.cursorMembershipId},"leaseToken"=NULL,"leaseExpiresAt"=NULL,"nextAttemptAt"=clock_timestamp() WHERE "eventId"=${c.eventId}::uuid AND "schoolId"=${c.schoolId} AND "leaseToken"=${c.leaseToken}::uuid`;
    await tx.outboxAttemptEvent.create({
      data: {
        id: randomUUID(),
        schoolId: c.schoolId,
        eventId: c.eventId,
        operatorUserId: u,
        attempt: c.attempt,
        outcome:
          c.kind === "NOTICE_WITHDRAWN"
            ? "SUPPRESSED"
            : more
              ? "CONTINUED"
              : "DELIVERED",
      },
    });
    return { processed: true, delivered };
  });
}
export async function failNoticeClaim(c: Claim, u: string) {
  inappEnabled();
  return noticeTransaction(async (tx) => {
    await requireWorker(tx, c.schoolId, u);
    const updated = await tx.$queryRaw<
      Array<{ failures: number; attempt: number }>
    >`UPDATE "OutboxDispatch" SET "failures"="failures"+1,"state"=CASE WHEN "failures"+1>=5 THEN 'DEAD_LETTER' ELSE 'RETRY_WAIT' END,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"nextAttemptAt"=clock_timestamp()+make_interval(secs=>LEAST(900,power(2,"failures"+1)::integer)) WHERE "schoolId"=${c.schoolId} AND "eventId"=${c.eventId}::uuid AND "state"='LEASED' AND "leaseToken"=${c.leaseToken}::uuid RETURNING "failures","attempt"`;
    if (updated.length)
      await tx.outboxAttemptEvent.create({
        data: {
          id: randomUUID(),
          schoolId: c.schoolId,
          eventId: c.eventId,
          operatorUserId: u,
          attempt: updated[0].attempt,
          outcome: updated[0].failures >= 5 ? "DEAD_LETTER" : "RETRY",
        },
      });
    return { recorded: !!updated.length };
  });
}
export async function deliverNoticeBatch(s: string, u: string) {
  inappEnabled();
  validSchool(s);
  let processed = 0,
    delivered = 0;
  for (let i = 0; i < 4; i++) {
    const c = await claimNoticeEvent(s, u);
    if (!c) break;
    try {
      const result = await processNoticeClaim(c, u);
      processed += result.processed ? 1 : 0;
      delivered += result.delivered;
    } catch (e) {
      await failNoticeClaim(c, u);
      if (e instanceof NoticeError && e.code === "NOT_FOUND") throw e;
    }
  }
  return { processed, delivered };
}

const replayInput = z
  .object({
    eventId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    requestKey: z.string().uuid(),
  })
  .strict();
export async function replayNoticeEvent(s: string, input: unknown) {
  inappEnabled();
  validSchool(s);
  const p = replayInput.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const u = await noticeActor(),
    d = p.data;
  return noticeTransaction(async (tx) => {
    await requireWorker(tx, s, u);
    const old = await tx.outboxReplayEvent.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.eventId !== d.eventId ||
        old.operatorUserId !== u ||
        old.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: old.id, replay: true };
    }
    const row = await tx.outboxReplayEvent.create({
      data: { id: randomUUID(), schoolId: s, operatorUserId: u, ...d },
    });
    return { id: row.id, replay: false };
  });
}

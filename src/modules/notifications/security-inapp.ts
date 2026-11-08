import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  NoticeError,
  noticeActor,
  noticeTransaction,
  validUuid,
} from "@/src/modules/communications/service";
export type SecurityChannel = "ACCOUNT" | "PLATFORM";
function enabled() {
  if (
    process.env.PHASE10_AUTH_SECURITY_ENABLED !== "true" ||
    process.env.PHASE10_SECURITY_INAPP_ENABLED !== "true" ||
    process.env.PHASE10_INAPP_ENABLED !== "true"
  )
    throw new NoticeError("NOT_FOUND");
}
async function currentUser(
  tx: Prisma.TransactionClient,
  userId: string,
  platform = false,
) {
  // Shared locks protect current role/existence without deadlocking two workers
  // that are also recipients of the same platform event.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR SHARE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  if (!user || (platform && user.platformRole !== "SUPER_ADMIN"))
    throw new NoticeError("NOT_FOUND");
}
export async function deliverSecurityBatchForActor(
  userId: string,
  selectedEventId?: string,
) {
  enabled();
  if (selectedEventId !== undefined) validUuid(selectedEventId);
  let eventId: string | undefined;
  try {
    return await noticeTransaction(async (tx) => {
      await currentUser(tx, userId, true);
      const events = await tx.$queryRaw<
        Array<{
          eventId: string;
          cursorUserId: string | null;
          subjectUserId: string | null;
        }>
      >`
    SELECT q."eventId",q."cursorUserId",e."subjectUserId" FROM "AuthSecurityOutbox" q JOIN "AuthSecurityEvidence" e ON e."id"=q."eventId"
    WHERE q."state" IN ('PENDING','RETRY_WAIT') AND q."nextAttemptAt"<=clock_timestamp() AND (${selectedEventId ?? null}::uuid IS NULL OR q."eventId"=${selectedEventId ?? null}::uuid)
    ORDER BY q."nextAttemptAt",q."eventId" LIMIT 1 FOR UPDATE OF q SKIP LOCKED`;
      const event = events[0];
      if (!event) return { processed: false, delivered: 0 };
      eventId = event.eventId;
      const recipients = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE (${event.cursorUserId}::text IS NULL OR "id">${event.cursorUserId})
    AND ("id"=${event.subjectUserId} OR (${event.subjectUserId}::text IS NULL AND "platformRole"='SUPER_ADMIN')) ORDER BY "id" LIMIT 100 FOR SHARE`;
      const delivered = recipients.length
        ? await tx.$executeRaw`INSERT INTO "SecurityDelivery"("eventId","recipientUserId") SELECT ${event.eventId}::uuid,u."id" FROM "User" u WHERE u."id" IN (${Prisma.join(recipients.map((r) => r.id))}) AND phase10_security_recipient(${event.eventId}::uuid,u."id") ORDER BY u."id" ON CONFLICT("eventId","recipientUserId") DO NOTHING`
        : 0;
      const state = recipients.length === 100 ? "PENDING" : "DONE";
      await tx.$executeRaw`UPDATE "AuthSecurityOutbox" SET "state"=${state},"cursorUserId"=${recipients.at(-1)?.id ?? event.cursorUserId} WHERE "eventId"=${event.eventId}::uuid`;
      await tx.securityOutboxAttempt.create({
        data: {
          eventId: event.eventId,
          actorUserId: userId,
          outcome: state === "DONE" ? "DONE" : "PAGE",
          reason: "Atomic bounded security delivery page",
        },
      });
      return { processed: true, delivered };
    });
  } catch (error) {
    if (
      !eventId ||
      (error instanceof NoticeError && error.code === "NOT_FOUND")
    )
      throw error;
    await noticeTransaction(async (tx) => {
      await currentUser(tx, userId, true);
      const changed =
        await tx.$executeRaw`UPDATE "AuthSecurityOutbox" SET "failures"="failures"+1,"state"=CASE WHEN "failures"+1>=5 THEN 'DEAD_LETTER' ELSE 'RETRY_WAIT' END,"nextAttemptAt"=clock_timestamp()+interval '30 seconds' WHERE "eventId"=${eventId}::uuid AND "state" IN ('PENDING','RETRY_WAIT') AND "failures"<5`;
      if (changed)
        await tx.securityOutboxAttempt.create({
          data: {
            eventId: eventId!,
            actorUserId: userId,
            outcome: "FAILED",
            reason:
              "Security delivery transaction failed; no private content recorded",
          },
        });
    });
    return { processed: false, delivered: 0 };
  }
}
export async function runSecurityDelivery(input: unknown) {
  enabled();
  const parsed = z
    .object({ eventId: z.string().uuid().optional() })
    .strict()
    .safeParse(input);
  if (!parsed.success) throw new NoticeError("INVALID_INPUT");
  return deliverSecurityBatchForActor(await noticeActor(), parsed.data.eventId);
}
export async function readSecurityInbox(
  channel: SecurityChannel,
  cursor?: string,
) {
  enabled();
  if (cursor !== undefined) validUuid(cursor);
  const userId = await noticeActor();
  return noticeTransaction(async (tx) => {
    await currentUser(tx, userId, channel === "PLATFORM");
    const common = Prisma.sql`FROM "SecurityDelivery" d JOIN "AuthSecurityEvidence" e ON e."id"=d."eventId"
   LEFT JOIN LATERAL(SELECT i."action" FROM "SecurityDeliveryInteraction" i WHERE i."deliveryId"=d."id" ORDER BY i."ordinal" DESC LIMIT 1) i ON true
   WHERE d."recipientUserId"=${userId} AND ((${channel}='ACCOUNT' AND e."subjectUserId"=${userId}) OR (${channel}='PLATFORM' AND e."subjectUserId" IS NULL))
   AND phase10_security_recipient(d."eventId",${userId}) AND NOT EXISTS(SELECT 1 FROM "SecurityDeliverySuppression" x WHERE x."deliveryId"=d."id")`;
    if (cursor) {
      const found = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT d."id" ${common} AND d."id"=${cursor}::uuid`,
      );
      if (!found.length) throw new NoticeError("NOT_FOUND");
    }
    const rows = await tx.$queryRaw<
      Array<{ id: string; createdAt: Date; action: string }>
    >(
      Prisma.sql`SELECT d."id",d."createdAt",COALESCE(i."action",'UNREAD') AS action ${common} ${cursor ? Prisma.sql`AND (d."createdAt",d."id")<(SELECT c."createdAt",c."id" FROM "SecurityDelivery" c WHERE c."id"=${cursor}::uuid AND c."recipientUserId"=${userId})` : Prisma.empty} ORDER BY d."createdAt" DESC,d."id" DESC LIMIT 51`,
    );
    const counts = await tx.$queryRaw<Array<{ count: string }>>(
      Prisma.sql`SELECT count(*)::text AS count ${common} AND COALESCE(i."action",'UNREAD')='UNREAD'`,
    );
    const more = rows.length > 50;
    if (more) rows.pop();
    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        read: row.action === "READ",
        text: "A security update is available",
        href:
          channel === "ACCOUNT" ? "/account/security" : "/platform/security",
      })),
      nextCursor: more ? rows.at(-1)!.id : null,
      unreadCount: counts[0].count,
    };
  });
}
export async function changeSecurityNotification(
  channel: SecurityChannel,
  id: string,
  input: unknown,
) {
  enabled();
  validUuid(id);
  const parsed = z
    .object({
      action: z.enum(["READ", "UNREAD"]),
      requestKey: z.string().uuid(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) throw new NoticeError("INVALID_INPUT");
  const userId = await noticeActor(),
    data = parsed.data;
  return noticeTransaction(async (tx) => {
    await currentUser(tx, userId, channel === "PLATFORM");
    const permitted = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT d."id" FROM "SecurityDelivery" d JOIN "AuthSecurityEvidence" e ON e."id"=d."eventId" WHERE d."id"=${id}::uuid AND d."recipientUserId"=${userId} AND ((${channel}='ACCOUNT' AND e."subjectUserId"=${userId}) OR (${channel}='PLATFORM' AND e."subjectUserId" IS NULL)) AND phase10_security_recipient(d."eventId",${userId}) AND NOT EXISTS(SELECT 1 FROM "SecurityDeliverySuppression" x WHERE x."deliveryId"=d."id") FOR UPDATE OF d`;
    if (!permitted.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.securityDeliveryInteraction.findUnique({
      where: {
        deliveryId_requestKey: { deliveryId: id, requestKey: data.requestKey },
      },
    });
    if (old) {
      if (old.action !== data.action || old.actorUserId !== userId)
        throw new NoticeError("CONFLICT");
      return { id: old.id, replay: true };
    }
    const interaction = await tx.securityDeliveryInteraction.create({
      data: {
        deliveryId: id,
        actorUserId: userId,
        action: data.action,
        requestKey: data.requestKey,
      },
    });
    return { id: interaction.id, replay: false };
  });
}
export async function replaySecurityDelivery(input: unknown) {
  enabled();
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      requestKey: z.string().uuid(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) throw new NoticeError("INVALID_INPUT");
  const userId = await noticeActor(),
    data = parsed.data;
  return noticeTransaction(async (tx) => {
    await currentUser(tx, userId, true);
    const old = await tx.securityOutboxAttempt.findUnique({
      where: { requestKey: data.requestKey },
    });
    if (old) {
      if (
        old.eventId !== data.eventId ||
        old.actorUserId !== userId ||
        old.reason !== data.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: old.id, replay: true };
    }
    const changed =
      await tx.$executeRaw`UPDATE "AuthSecurityOutbox" SET "state"='PENDING',"failures"=0,"nextAttemptAt"=clock_timestamp() WHERE "eventId"=${data.eventId}::uuid AND "state"='DEAD_LETTER'`;
    if (!changed) throw new NoticeError("NOT_FOUND");
    const attempt = await tx.securityOutboxAttempt.create({
      data: {
        id: randomUUID(),
        eventId: data.eventId,
        actorUserId: userId,
        outcome: "REPLAY",
        reason: data.reason,
        requestKey: data.requestKey,
      },
    });
    return { id: attempt.id, replay: false };
  });
}

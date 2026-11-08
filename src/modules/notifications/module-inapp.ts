import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  noticeStaff,
  noticeTransaction,
  validSchool,
  validUuid,
} from "@/src/modules/communications/service";
function supportedSources() {
  const sources: string[] = [];
  if (process.env.PHASE10_LEARNING_ASSIGNMENTS_ENABLED === "true")
    sources.push(
      "LearningAssignmentEvent",
      "LearningSubmissionRevision",
      "LearningSubmissionReview",
    );
  if (process.env.PHASE10_LIBRARY_ENABLED === "true")
    sources.push("LibraryCatalogRelease");
  if (
    process.env.PHASE10_LIBRARY_ENABLED === "true" &&
    process.env.PHASE10_ASSETS_ENABLED === "true"
  )
    sources.push("LearningAssetRelease");
  return sources;
}
function enabled() {
  if (
    process.env.PHASE10_INAPP_ENABLED !== "true" ||
    process.env.PHASE10_MODULE_INAPP_ENABLED !== "true" ||
    supportedSources().length === 0
  )
    throw new NoticeError("NOT_FOUND");
}
export async function deliverModuleBatch(s: string, u: string) {
  enabled();
  validSchool(s);
  let eventId: string | undefined;
  try {
    return await noticeTransaction(async (tx) => {
      await noticeStaff(tx, s, u, true);
      const events = await tx.$queryRaw<
        Array<{
          eventId: string;
          cursorMembershipId: string | null;
          action: string;
        }>
      >`SELECT q."eventId",q."cursorMembershipId",e."action" FROM "SchoolSourceOutbox" q JOIN "SchoolSourceEvent" e ON e."schoolId"=q."schoolId" AND e."id"=q."eventId" WHERE q."schoolId"=${s} AND q."state" IN ('PENDING','RETRY_WAIT') AND q."nextAttemptAt"<=clock_timestamp() AND e."sourceType" IN (${Prisma.join(supportedSources())}) ORDER BY q."nextAttemptAt",q."eventId" LIMIT 1 FOR UPDATE OF q SKIP LOCKED`;
      const e = events[0];
      if (!e) return { processed: false, delivered: 0 };
      eventId = e.eventId;
      const recipients = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Membership" WHERE "schoolId"=${s} AND (${e.cursorMembershipId}::text IS NULL OR "id">${e.cursorMembershipId}) ORDER BY "id" LIMIT 100`;
      let delivered = 0;
      for (const recipient of recipients)
        delivered +=
          await tx.$executeRaw`INSERT INTO "ModuleDelivery"("id","schoolId","eventId","recipientMembershipId") SELECT ${randomUUID()}::uuid,${s},${e.eventId}::uuid,m."id" FROM "Membership" m WHERE m."schoolId"=${s} AND m."id"=${recipient.id} AND can_read_module_notification(${s},${e.eventId}::uuid,m."userId") ON CONFLICT("schoolId","eventId","recipientMembershipId") DO NOTHING`;
      const state = recipients.length === 100 ? "PENDING" : "DONE";
      await tx.$executeRaw`UPDATE "SchoolSourceOutbox" SET "state"=${state},"cursorMembershipId"=${recipients.at(-1)?.id ?? e.cursorMembershipId} WHERE "schoolId"=${s} AND "eventId"=${e.eventId}::uuid`;
      await tx.$executeRaw`INSERT INTO "ModuleOutboxAttempt"("id","schoolId","eventId","actorUserId","outcome","reason") VALUES(${randomUUID()}::uuid,${s},${e.eventId}::uuid,${u},${state === "DONE" ? "DONE" : "PAGE"},'Bounded atomic module delivery page')`;
      return { processed: true, delivered };
    });
  } catch (error) {
    if (
      !eventId ||
      (error instanceof NoticeError && error.code === "NOT_FOUND")
    )
      throw error;
    await noticeTransaction(async (tx) => {
      await noticeStaff(tx, s, u, true);
      const changed =
        await tx.$executeRaw`UPDATE "SchoolSourceOutbox" SET "failures"="failures"+1,"state"=CASE WHEN "failures"+1>=5 THEN 'DEAD_LETTER' ELSE 'RETRY_WAIT' END,"nextAttemptAt"=clock_timestamp()+interval '30 seconds' WHERE "schoolId"=${s} AND "eventId"=${eventId}::uuid AND "state" IN ('PENDING','RETRY_WAIT') AND "failures"<5`;
      if (changed)
        await tx.$executeRaw`INSERT INTO "ModuleOutboxAttempt"("id","schoolId","eventId","actorUserId","outcome","reason") VALUES(${randomUUID()}::uuid,${s},${eventId}::uuid,${u},'FAILED','Module delivery transaction failed; no content recorded')`;
    });
    return { processed: false, delivered: 0 };
  }
}
export async function runModuleDelivery(s: string) {
  enabled();
  const u = await noticeActor();
  return deliverModuleBatch(s, u);
}
export async function readModuleInbox(s: string, cursor?: string) {
  enabled();
  validSchool(s);
  if (cursor) validUuid(cursor);
  const u = await noticeActor();
  const membership = await prisma.membership.findFirst({
    where: {
      schoolId: s,
      userId: u,
      isActive: true,
      school: { isActive: true },
      role: {
        in: [
          "STUDENT",
          "TEACHER",
          "FORM_TEACHER",
          "HEAD_OF_SECTION",
          "PRINCIPAL",
          "SCHOOL_ADMIN",
          "SCHOOL_SUPER_ADMIN",
        ],
      },
    },
    select: { id: true },
  });
  if (!membership) throw new NoticeError("NOT_FOUND");
  const common = Prisma.sql`FROM "ModuleDelivery" d JOIN "SchoolSourceEvent" e ON e."schoolId"=d."schoolId" AND e."id"=d."eventId" JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=${u} LEFT JOIN LATERAL(SELECT i."action" FROM "ModuleDeliveryInteraction" i WHERE i."schoolId"=d."schoolId" AND i."deliveryId"=d."id" ORDER BY i."ordinal" DESC LIMIT 1) i ON true WHERE d."schoolId"=${s} AND e."sourceType" IN (${Prisma.join(supportedSources())}) AND can_read_module_notification(d."schoolId",d."eventId",${u}) AND NOT EXISTS(SELECT 1 FROM "ModuleDeliverySuppression" x WHERE x."deliveryId"=d."id")`;
  if (cursor) {
    const found = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT d."id" ${common} AND d."id"=${cursor}::uuid`,
    );
    if (!found.length) throw new NoticeError("NOT_FOUND");
  }
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      eventId: string;
      sourceType: string;
      sourceId: string;
      sourceAction: string;
      releaseId: string | null;
      createdAt: Date;
      action: string;
    }>
  >(
    Prisma.sql`SELECT d."id",d."eventId",e."sourceType",e."sourceId",e."action" AS "sourceAction",CASE WHEN e."sourceType"='LearningSubmissionRevision' THEN (SELECT submitted."releaseId"::text FROM "LearningSubmissionRevision" submitted WHERE submitted."schoolId"=e."schoolId" AND submitted."id"::text=e."sourceId") WHEN e."sourceType"='LearningSubmissionReview' THEN (SELECT submitted."releaseId"::text FROM "LearningSubmissionReview" review JOIN "LearningSubmissionRevision" submitted ON submitted."schoolId"=review."schoolId" AND submitted."id"=review."submissionId" WHERE review."schoolId"=e."schoolId" AND review."id"::text=e."sourceId") ELSE NULL END AS "releaseId",d."createdAt",COALESCE(i."action",'UNREAD') AS action ${common} ${cursor ? Prisma.sql`AND (d."createdAt",d."id")<(SELECT c."createdAt",c."id" FROM "ModuleDelivery" c WHERE c."schoolId"=${s} AND c."id"=${cursor}::uuid)` : Prisma.empty} ORDER BY d."createdAt" DESC,d."id" DESC LIMIT 51`,
  );
  const counts = await prisma.$queryRaw<Array<{ count: string }>>(
    Prisma.sql`SELECT COUNT(*)::text AS count ${common} AND COALESCE(i."action",'UNREAD')='UNREAD'`,
  );
  const more = rows.length > 50;
  if (more) rows.pop();
  return {
    items: rows.map((i) => ({
      id: i.id,
      read: i.action === "READ",
      createdAt: i.createdAt,
      text: "A learning or resource workflow update is available",
      href:
        i.sourceType === "LibraryCatalogRelease" ||
        i.sourceType === "LearningAssetRelease"
          ? `/schools/${encodeURIComponent(s)}/library`
          : `/schools/${encodeURIComponent(s)}/learning-assignments${i.releaseId || (i.sourceType === "LearningAssignmentEvent" && i.sourceAction === "RELEASE") ? "?releaseId=" + encodeURIComponent(i.releaseId ?? i.sourceId) : ""}`,
    })),
    nextCursor: more ? rows.at(-1)!.id : null,
    unreadCount: counts[0].count,
  };
}
const interaction = z
  .object({ action: z.enum(["READ", "UNREAD"]), requestKey: z.string().uuid() })
  .strict();
export async function changeModuleNotification(
  s: string,
  id: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(id);
  const p = interaction.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
    const allowed = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT d."id" FROM "ModuleDelivery" d JOIN "SchoolSourceEvent" e ON e."schoolId"=d."schoolId" AND e."id"=d."eventId" JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=${u} WHERE d."schoolId"=${s} AND d."id"=${id}::uuid AND e."sourceType" IN (${Prisma.join(supportedSources())}) AND can_read_module_notification(${s},d."eventId",${u}) AND NOT EXISTS(SELECT 1 FROM "ModuleDeliverySuppression" x WHERE x."deliveryId"=d."id")`;
    if (!allowed.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{ deliveryId: string; actorUserId: string; action: string }>
    >`SELECT * FROM "ModuleDeliveryInteraction" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      if (
        old[0].deliveryId !== id ||
        old[0].actorUserId !== u ||
        old[0].action !== d.action
      )
        throw new NoticeError("CONFLICT");
      return { id, replay: true };
    }
    await tx.$executeRaw`INSERT INTO "ModuleDeliveryInteraction"("id","schoolId","deliveryId","actorUserId","action","requestKey") VALUES(${randomUUID()}::uuid,${s},${id}::uuid,${u},${d.action},${d.requestKey}::uuid)`;
    return { id, replay: false };
  });
}

const replay = z
  .object({
    eventId: z.string().uuid(),
    requestKey: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export async function replayModuleDelivery(s: string, input: unknown) {
  enabled();
  validSchool(s);
  const p = replay.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        eventId: string;
        actorUserId: string;
        reason: string;
      }>
    >`SELECT * FROM "ModuleOutboxAttempt" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.eventId !== d.eventId ||
        o.actorUserId !== u ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const changed =
      await tx.$executeRaw`UPDATE "SchoolSourceOutbox" SET "state"='PENDING',"failures"=0,"nextAttemptAt"=clock_timestamp() WHERE "schoolId"=${s} AND "eventId"=${d.eventId}::uuid AND "state"='DEAD_LETTER'`;
    if (!changed) throw new NoticeError("NOT_FOUND");
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "ModuleOutboxAttempt"("id","schoolId","eventId","actorUserId","outcome","reason","requestKey") VALUES(${id}::uuid,${s},${d.eventId}::uuid,${u},'REPLAY',${d.reason},${d.requestKey}::uuid)`;
    return { id, replay: false };
  });
}

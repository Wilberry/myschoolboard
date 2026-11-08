import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeTransaction,
  validSchool,
} from "@/src/modules/communications/service";
import { z } from "zod";

function enabled() {
  if (process.env.PHASE10_SUBSCRIPTION_BOUNDARIES_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
async function operator(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
  const current = await tx.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  if (current?.platformRole !== "SUPER_ADMIN")
    throw new NoticeError("NOT_FOUND");
}
export async function captureSubscriptionBoundariesForActor(userId: string) {
  enabled();
  return noticeTransaction(async (tx) => {
    await operator(tx, userId);
    // Bounded due periods, with row locks and a durable unique source identity.
    // No caller clock, entitlement update, school reactivation or inferred actor.
    const due = await tx.$queryRaw<
      Array<{ id: string; schoolId: string; endsAt: Date }>
    >`
      SELECT p."id",p."schoolId",p."endsAt" FROM "SchoolSubscriptionPeriod" p
      WHERE p."endsAt"<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM "SubscriptionBoundaryEvent" e WHERE e."schoolId"=p."schoolId" AND e."periodId"=p."id" AND e."kind"='SUBSCRIPTION_ENDED')
      ORDER BY p."endsAt",p."schoolId",p."id" LIMIT 100 FOR UPDATE OF p SKIP LOCKED`;
    let captured = 0;
    for (const period of due)
      captured +=
        await tx.$executeRaw`INSERT INTO "SubscriptionBoundaryEvent"("schoolId","periodId","kind","boundaryAt","actorUserId") VALUES(${period.schoolId},${period.id},'SUBSCRIPTION_ENDED',${period.endsAt},${userId}) ON CONFLICT("schoolId","periodId","kind") DO NOTHING`;
    return { captured, more: due.length === 100 };
  });
}
export async function captureSubscriptionBoundaries() {
  enabled();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new NoticeError("UNAUTHENTICATED");
  return captureSubscriptionBoundariesForActor(session.user.id);
}
const cursorSchema = z
  .object({ at: z.string().datetime({ precision: 6 }), id: z.string().uuid() })
  .strict();
export async function readPlatformOperationalEvidence(
  schoolId: string,
  cursor?: string,
) {
  enabled();
  validSchool(schoolId);
  let position: z.infer<typeof cursorSchema> | undefined;
  if (cursor !== undefined) {
    if (!cursor || cursor.length > 500 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new NoticeError("INVALID_INPUT");
    try {
      position = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new NoticeError("INVALID_INPUT");
    }
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new NoticeError("UNAUTHENTICATED");
  return noticeTransaction(async (tx) => {
    await operator(tx, session.user.id);
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        schoolId: string;
        sourceType: string;
        sourceId: string;
        action: string;
        at: string;
      }>
    >`
      SELECT e."id",e."schoolId",e."sourceType",e."sourceId",e."action",to_char(e."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
      FROM "SchoolSourceEvent" e WHERE e."schoolId"=${schoolId} AND e."sourceType" IN ('SubscriptionBoundaryEvent','SchoolLifecycleEvent')
      AND (${position?.id ?? null}::uuid IS NULL OR (e."createdAt",e."id")<(${position?.at ?? null}::timestamptz,${position?.id ?? null}::uuid))
      ORDER BY e."createdAt" DESC,e."id" DESC LIMIT 101`;
    const more = rows.length > 100;
    if (more) rows.pop();
    const last = rows.at(-1);
    return {
      evidence: rows,
      nextCursor:
        more && last
          ? Buffer.from(JSON.stringify({ at: last.at, id: last.id })).toString(
              "base64url",
            )
          : null,
    };
  });
}

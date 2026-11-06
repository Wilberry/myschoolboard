import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
export class TrashError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "UNAUTHENTICATED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INTERNAL",
  ) {
    super(code);
  }
}
const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const schoolInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("TRASH"),
      noteId: identifier,
      requestKey: z.string().uuid(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
  z
    .object({
      action: z.enum(["RESTORE", "REMOVE_SCHOOL"]),
      caseId: z.string().uuid(),
      expectedVersion: z.number().int().min(1),
      requestKey: z.string().uuid(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
]);
const platformInput = z
  .object({
    action: z.enum(["AUTHORIZE_RECOVERY", "HOLD", "RELEASE_HOLD"]),
    caseId: z.string().uuid(),
    schoolId: identifier,
    expectedVersion: z.number().int().min(1),
    requestKey: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export interface TrashRow {
  id: string;
  schoolId: string;
  noteId: string;
  state: string;
  createdAt: Date;
  schoolExpiresAt: Date;
  platformExpiresAt: Date | null;
  recoveryExpiresAt: Date | null;
  legalHold: boolean;
  version: number;
}
export function requireTrashEnabled() {
  if (process.env.PHASE11_TRASH_ENABLED !== "true")
    throw new TrashError("NOT_FOUND");
}
export async function trashActor() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TrashError("UNAUTHENTICATED");
  return session.user.id;
}
async function platformActor(userId: string) {
  if (
    !(await prisma.user.findFirst({
      where: { id: userId, platformRole: "SUPER_ADMIN" },
      select: { id: true },
    }))
  )
    throw new TrashError("NOT_FOUND");
}
const fields = Prisma.raw(
  'c."id",c."schoolId",c."noteId",c."state",c."createdAt",c."schoolExpiresAt",c."platformExpiresAt",c."recoveryExpiresAt",c."legalHold",c."version"',
);
export async function readSchoolTrash(schoolId: string) {
  requireTrashEnabled();
  if (!identifier.safeParse(schoolId).success)
    throw new TrashError("INVALID_INPUT");
  const userId = await trashActor();
  const role = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: { in: ["SCHOOL_SUPER_ADMIN", "TEACHER"] },
      school: { isActive: true },
    },
    select: { id: true, role: true },
  });
  if (!role) throw new TrashError("NOT_FOUND");
  const items = await prisma.$queryRaw<TrashRow[]>(
    Prisma.sql`SELECT ${fields} FROM "TrashCase" c WHERE c."schoolId"=${schoolId} AND ((c."state"='SCHOOL' AND phase11_now()<c."schoolExpiresAt") OR (c."state"='RECOVERY_AVAILABLE' AND phase11_now()<c."recoveryExpiresAt" AND phase11_now()<c."platformExpiresAt")) AND phase11_source_authorized(c."schoolId",c."noteId",${userId}) ORDER BY c."createdAt" DESC,c."id" LIMIT 100`,
  );
  // Author-only source options repeat current authority in the final SQL.
  const candidates = await prisma.$queryRaw<
    Array<{ id: string; topic: string }>
  >`SELECT n."id",n."topic" FROM "LessonNote" n JOIN "Membership" m ON m."schoolId"=n."schoolId" AND m."id"=n."teacherMembershipId" AND m."userId"=${userId} AND m."isActive" AND m."role"='TEACHER' WHERE n."schoolId"=${schoolId} AND n."status"='DRAFT' AND n."submittedAt" IS NULL AND phase11_source_authorized(n."schoolId",n."id",${userId}) AND NOT EXISTS(SELECT 1 FROM "LessonNoteEvent" e WHERE e."schoolId"=n."schoolId" AND e."noteId"=n."id" AND e."eventType" NOT IN ('CREATED','REVISED')) AND NOT EXISTS(SELECT 1 FROM "TrashCase" c WHERE c."schoolId"=n."schoolId" AND c."noteId"=n."id" AND c."state"<>'RESTORED') ORDER BY n."updatedAt" DESC,n."id" LIMIT 100`;
  return { items, candidates, role: role.role };
}
export async function readPlatformTrash() {
  requireTrashEnabled();
  const userId = await trashActor();
  await platformActor(userId);
  const items = await prisma.$queryRaw<TrashRow[]>(
    Prisma.sql`SELECT ${fields} FROM "TrashCase" c JOIN "User" u ON u."id"=${userId} AND u."platformRole"='SUPER_ADMIN' WHERE c."state" IN ('PLATFORM','RECOVERY_AVAILABLE','PURGE_BLOCKED') ORDER BY c."createdAt" DESC,c."id" LIMIT 100`,
  );
  return { items };
}
type ActionData = {
  action: string;
  caseId?: string;
  noteId?: string;
  expectedVersion?: number;
  requestKey: string;
  reason: string;
};
async function change(
  schoolId: string,
  userId: string,
  data: ActionData,
  platform: boolean,
) {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId} FOR UPDATE`;
          if (platform) {
            if (
              !(
                await tx.$queryRaw<
                  Array<{ id: string }>
                >`SELECT "id" FROM "User" WHERE "id"=${userId} AND "platformRole"='SUPER_ADMIN' FOR UPDATE`
              ).length
            )
              throw new TrashError("NOT_FOUND");
          }
          const replay = await tx.trashEvent.findUnique({
            where: {
              schoolId_requestKey: { schoolId, requestKey: data.requestKey },
            },
            include: { trashCase: true },
          });
          if (replay) {
            const c = replay.trashCase;
            if (
              !platform &&
              (!(
                await tx.$queryRaw<
                  Array<{ allowed: boolean }>
                >`SELECT phase11_source_authorized(${schoolId},${c.noteId},${userId}) AS allowed`
              )[0]?.allowed ||
                !["SCHOOL", "RECOVERY_AVAILABLE", "RESTORED"].includes(c.state))
            )
              throw new TrashError("NOT_FOUND");
            if (
              replay.actorUserId !== userId ||
              replay.action !== data.action ||
              replay.reason !== data.reason ||
              (data.noteId ? c.noteId !== data.noteId : c.id !== data.caseId) ||
              (data.expectedVersion !== undefined &&
                replay.version !== data.expectedVersion + 1)
            )
              throw new TrashError("CONFLICT");
            return {
              id: c.id,
              state: c.state,
              version: c.version,
              replay: true,
            };
          }
          let caseId = data.caseId;
          if (data.action === "TRASH") {
            if (
              !(
                await tx.$queryRaw<
                  Array<{ allowed: boolean }>
                >`SELECT phase11_source_authorized(${schoolId},${data.noteId!},${userId}) AS allowed`
              )[0]?.allowed
            )
              throw new TrashError("NOT_FOUND");
            // Server chooses identity and all timestamps; INSERT trigger derives retention.
            caseId = randomUUID();
            await tx.$executeRaw`INSERT INTO "TrashCase" ("id","schoolId","noteId","schoolExpiresAt") VALUES (${caseId}::uuid,${schoolId},${data.noteId!},clock_timestamp())`;
          }
          if (!caseId) throw new TrashError("INVALID_INPUT");
          await tx.$executeRaw`INSERT INTO "TrashEvent" ("id","schoolId","caseId","action","actorUserId","requestKey","reason","version") VALUES (${randomUUID()}::uuid,${schoolId},${caseId}::uuid,${data.action},${userId},${data.requestKey}::uuid,${data.reason},${data.expectedVersion ?? 0})`;
          const c = await tx.trashCase.findFirst({
            where: { schoolId, id: caseId },
            select: { id: true, state: true, version: true },
          });
          if (!c) throw new TrashError("NOT_FOUND");
          return { ...c, replay: false };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (e instanceof TrashError) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (
          e.code === "P2010" &&
          ["40001", "40P01", "23505"].includes(
            String(
              (
                e.meta?.driverAdapterError as
                  { cause?: { originalCode?: string } } | undefined
              )?.cause?.originalCode ?? e.meta?.code,
            ),
          ) &&
          attempt < 2
        )
          continue;
        if (["P2002", "P2034"].includes(e.code) && attempt < 2) continue;
        if (["P2002", "P2034", "P2010"].includes(e.code)) {
          const code =
            (
              e.meta?.driverAdapterError as
                { cause?: { originalCode?: string } } | undefined
            )?.cause?.originalCode ?? e.meta?.code;
          if (code === "23503") throw new TrashError("NOT_FOUND");
          throw new TrashError("CONFLICT");
        }
        if (e.code === "P2003") throw new TrashError("NOT_FOUND");
      }
      throw new TrashError("INTERNAL");
    }
  throw new TrashError("CONFLICT");
}
export async function changeSchoolTrash(schoolId: string, input: unknown) {
  requireTrashEnabled();
  if (!identifier.safeParse(schoolId).success)
    throw new TrashError("INVALID_INPUT");
  const parsed = schoolInput.safeParse(input);
  if (!parsed.success) throw new TrashError("INVALID_INPUT");
  return change(schoolId, await trashActor(), parsed.data, false);
}
export async function changePlatformTrash(input: unknown) {
  requireTrashEnabled();
  const parsed = platformInput.safeParse(input);
  if (!parsed.success) throw new TrashError("INVALID_INPUT");
  const user = await trashActor();
  await platformActor(user);
  return change(parsed.data.schoolId, user, parsed.data, true);
}
// Local explicit operator invocation only. No public cron endpoint or system-user impersonation.
export async function expireTrashBatch(userId: string) {
  requireTrashEnabled();
  await platformActor(userId);
  const results = [];
  for (const action of [
    "EXPIRE_SCHOOL",
    "EXPIRE_RECOVERY",
    "EXPIRE_PLATFORM",
  ]) {
    const condition =
      action === "EXPIRE_SCHOOL"
        ? Prisma.sql`c."state"='SCHOOL' AND c."schoolExpiresAt"<=phase11_now()`
        : action === "EXPIRE_RECOVERY"
          ? Prisma.sql`c."state"='RECOVERY_AVAILABLE' AND c."recoveryExpiresAt"<=phase11_now()`
          : Prisma.sql`c."state" IN ('PLATFORM','RECOVERY_AVAILABLE') AND c."platformExpiresAt"<=phase11_now()`;
    const due = await prisma.$queryRaw<TrashRow[]>(
      Prisma.sql`SELECT ${fields} FROM "TrashCase" c WHERE ${condition} ORDER BY c."createdAt",c."id" LIMIT 100`,
    );
    for (const c of due)
      try {
        results.push(
          await change(
            c.schoolId,
            userId,
            {
              action,
              caseId: c.id,
              expectedVersion: c.version,
              requestKey: randomUUID(),
              reason:
                "Scheduled retention boundary evaluation; protected history retained",
            },
            true,
          ),
        );
      } catch (e) {
        if (!(
          e instanceof TrashError && ["CONFLICT", "NOT_FOUND"].includes(e.code)
        ))
          throw e;
      }
  }
  return { processed: results.length, results };
}

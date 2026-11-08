import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  noticeTransaction,
  validSchool,
  validUuid,
} from "@/src/modules/communications/service";
function enabled() {
  if (process.env.PHASE10_LEARNING_ASSIGNMENTS_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
const input = z
  .object({
    expectedSubmissionRevision: z.number().int().min(0).max(19),
    text: z.string().trim().min(1).max(20000),
    assetReleaseIds: z
      .array(z.string().uuid())
      .max(3)
      .default([])
      .refine((a) => new Set(a).size === a.length)
      .transform((a) => [...a].sort()),
    requestKey: z.string().uuid(),
  })
  .strict();
export async function submitLearningWork(
  s: string,
  release: string,
  value: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(release);
  const p = input.safeParse(value);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  if (
    d.assetReleaseIds.length &&
    (process.env.PHASE10_ASSETS_ENABLED !== "true" ||
      process.env.PHASE10_LIBRARY_ENABLED !== "true")
  )
    throw new NoticeError("NOT_FOUND");
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
    const pupil = await tx.$queryRaw<
      Array<{ studentId: string; enrollmentId: string }>
    >`SELECT child.* FROM phase10_task_pupil(${s},${release}::uuid,${u}) child JOIN "LearningAssignmentEvent" e ON e."schoolId"=${s} AND e."id"=${release}::uuid JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN "LearningAssignmentPolicy" policy ON policy."schoolId"=a."schoolId" AND policy."id"=a."policyId" JOIN "LearningAssignmentRevision" v ON v."schoolId"=e."schoolId" AND v."taskId"=e."taskId" AND v."revision"=e."revision" WHERE v."submissionsEnabled" AND policy."allowTextSubmissions" AND (v."dueAt">=clock_timestamp() OR policy."allowLateSubmissions") ORDER BY child."enrollmentId" LIMIT 1`;
    const child = pupil[0];
    if (!child) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        releaseId: string;
        studentId: string;
        actorUserId: string;
        revision: number;
        text: string;
        assetReleaseIds: string[];
      }>
    >`SELECT * FROM "LearningSubmissionRevision" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.releaseId !== release ||
        o.studentId !== child.studentId ||
        o.actorUserId !== u ||
        o.revision !== d.expectedSubmissionRevision + 1 ||
        o.text !== d.text ||
        JSON.stringify(o.assetReleaseIds) !== JSON.stringify(d.assetReleaseIds)
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    const refs = d.assetReleaseIds.length
      ? Prisma.sql`ARRAY[${Prisma.join(d.assetReleaseIds.map((id) => Prisma.sql`${id}::uuid`))}]::uuid[]`
      : Prisma.sql`ARRAY[]::uuid[]`;
    await tx.$executeRaw(
      Prisma.sql`INSERT INTO "LearningSubmissionRevision"("id","schoolId","releaseId","studentId","enrollmentId","revision","text","assetReleaseIds","actorUserId","requestKey") VALUES(${id}::uuid,${s},${release}::uuid,${child.studentId},${child.enrollmentId},${d.expectedSubmissionRevision + 1},${d.text},${refs},${u},${d.requestKey}::uuid)`,
    );
    return { id, replay: false };
  });
}
const review = z
  .object({
    action: z.enum(["APPROVE", "RETURN"]),
    reason: z.string().trim().min(5).max(500),
    requestKey: z.string().uuid(),
  })
  .strict();
export async function reviewLearningWork(
  s: string,
  submission: string,
  value: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(submission);
  const p = review.safeParse(value);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
    const permitted = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT submitted."id" FROM "LearningSubmissionRevision" submitted JOIN "LearningAssignmentEvent" e ON e."schoolId"=submitted."schoolId" AND e."id"=submitted."releaseId" JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" WHERE submitted."schoolId"=${s} AND submitted."id"=${submission}::uuid AND a."authorUserId"=${u} AND phase10_task_author(a) AND can_read_learning_assignment(${s},e."id",${u})`;
    if (!permitted.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        submissionId: string;
        actorUserId: string;
        action: string;
        reason: string;
      }>
    >`SELECT * FROM "LearningSubmissionReview" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.submissionId !== submission ||
        o.actorUserId !== u ||
        o.action !== d.action ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningSubmissionReview"("id","schoolId","submissionId","action","actorUserId","requestKey","reason") VALUES(${id}::uuid,${s},${submission}::uuid,${d.action},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function readLearningSubmissions(
  s: string,
  release: string,
  cursor?: string,
) {
  enabled();
  validSchool(s);
  validUuid(release);
  if (cursor) validUuid(cursor);
  const u = await noticeActor();
  const permitted = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (EXISTS(SELECT 1 FROM phase10_task_pupil(${s},${release}::uuid,${u})) OR EXISTS(SELECT 1 FROM "LearningAssignment" a JOIN "LearningAssignmentEvent" e ON e."schoolId"=a."schoolId" AND e."taskId"=a."id" WHERE e."schoolId"=${s} AND e."id"=${release}::uuid AND a."authorUserId"=${u} AND phase10_task_author(a) AND can_read_learning_assignment(${s},${release}::uuid,${u}))) AS allowed`;
  if (!permitted[0]?.allowed) throw new NoticeError("NOT_FOUND");
  if (cursor) {
    const visible = await prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT submitted."id" FROM "LearningSubmissionRevision" submitted JOIN "LearningAssignmentEvent" e ON e."schoolId"=submitted."schoolId" AND e."id"=submitted."releaseId" JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN LATERAL phase10_task_pupil(${s},${release}::uuid,submitted."actorUserId") child ON child."studentId"=submitted."studentId" AND child."enrollmentId"=submitted."enrollmentId" WHERE submitted."schoolId"=${s} AND submitted."releaseId"=${release}::uuid AND submitted."id"=${cursor}::uuid AND can_read_learning_assignment(${s},${release}::uuid,${u}) AND ((a."authorUserId"=${u} AND phase10_task_author(a)) OR submitted."actorUserId"=${u})`;
    if (!visible.length) throw new NoticeError("NOT_FOUND");
  }
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      revision: number;
      text: string;
      assetReleaseIds: string[];
      createdAt: Date;
      reviewAction: string | null;
      reviewReason: string | null;
      own: boolean;
      studentLabel: string;
    }>
  >`SELECT submitted."id",submitted."revision",submitted."text",ARRAY(SELECT id FROM unnest(submitted."assetReleaseIds") id WHERE ${process.env.PHASE10_ASSETS_ENABLED === "true" && process.env.PHASE10_LIBRARY_ENABLED === "true"} AND can_read_learning_asset(${s},id,${u})) AS "assetReleaseIds",submitted."createdAt",review."action" AS "reviewAction",review."reason" AS "reviewReason",submitted."actorUserId"=${u} AS own,pupil."admissionNumber" AS "studentLabel" FROM "LearningSubmissionRevision" submitted JOIN "LearningAssignmentEvent" e ON e."schoolId"=submitted."schoolId" AND e."id"=submitted."releaseId" JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN "StudentRecord" pupil ON pupil."schoolId"=submitted."schoolId" AND pupil."id"=submitted."studentId" JOIN LATERAL phase10_task_pupil(${s},${release}::uuid,submitted."actorUserId") child ON child."studentId"=submitted."studentId" AND child."enrollmentId"=submitted."enrollmentId" LEFT JOIN "LearningSubmissionReview" review ON review."schoolId"=submitted."schoolId" AND review."submissionId"=submitted."id" WHERE submitted."schoolId"=${s} AND submitted."releaseId"=${release}::uuid AND can_read_learning_assignment(${s},${release}::uuid,${u}) AND ((a."authorUserId"=${u} AND phase10_task_author(a)) OR submitted."actorUserId"=${u}) AND (${cursor ?? null}::uuid IS NULL OR (submitted."createdAt",submitted."id")<(SELECT c."createdAt",c."id" FROM "LearningSubmissionRevision" c WHERE c."schoolId"=${s} AND c."releaseId"=${release}::uuid AND c."id"=${cursor ?? null}::uuid)) ORDER BY submitted."createdAt" DESC,submitted."id" DESC LIMIT 101`;
  const more = rows.length > 100;
  if (more) rows.pop();
  return { submissions: rows, nextCursor: more ? rows.at(-1)!.id : null };
}

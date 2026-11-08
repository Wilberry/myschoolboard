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
const id = z.string().trim().min(1).max(128),
  key = z.string().uuid(),
  reason = z.string().trim().min(5).max(500);
const text = {
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
  requestKey: key,
  reason,
  dueAt: z.string().datetime({ offset: true }),
  submissionsEnabled: z.boolean().default(false),
  imageReferencesEnabled: z.boolean().default(false),
  assetReleaseIds: z
    .array(key)
    .max(3)
    .default([])
    .refine((a) => new Set(a).size === a.length)
    .transform((a) => [...a].sort()),
};
const draft = z
  .object({
    ...text,
    termId: id,
    policyId: key,
    assignmentId: id.optional(),
    formResponsibilityId: id.optional(),
  })
  .strict()
  .refine(
    (d) => Number(!!d.assignmentId) + Number(!!d.formResponsibilityId) === 1,
  );
const revise = z
  .object({ ...text, expectedRevision: z.number().int().positive() })
  .strict();
const transition = z
  .object({
    action: z.enum(["SUBMIT", "APPROVE", "RETURN", "RELEASE", "WITHDRAW"]),
    expectedRevision: z.number().int().positive(),
    targetReleaseId: key.optional(),
    requestKey: key,
    reason,
  })
  .strict()
  .refine((d) => (d.action === "WITHDRAW") === !!d.targetReleaseId);
function enabled() {
  if (process.env.PHASE10_LEARNING_ASSIGNMENTS_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const d = schema.safeParse(value);
  if (!d.success) throw new NoticeError("INVALID_INPUT");
  return d.data;
}
export async function createLearningAssignment(s: string, input: unknown) {
  enabled();
  validSchool(s);
  const d = parse(draft, input),
    u = await noticeActor();
  if (
    "assetReleaseIds" in d &&
    d.assetReleaseIds.length &&
    (process.env.PHASE10_ASSETS_ENABLED !== "true" ||
      process.env.PHASE10_LIBRARY_ENABLED !== "true")
  )
    throw new NoticeError("NOT_FOUND");
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
    const context = d.assignmentId
      ? await tx.$queryRaw<
          Array<{
            membershipId: string;
            classId: string;
            sessionId: string;
            subjectId: string;
          }>
        >`SELECT a."membershipId",a."classId",a."sessionId",a."subjectId" FROM "TeacherClassSubjectAssignment" a JOIN "Membership" m ON m."schoolId"=a."schoolId" AND m."id"=a."membershipId" AND m."userId"=${u} AND m."isActive" WHERE a."schoolId"=${s} AND a."id"=${d.assignmentId} AND a."status"='ACTIVE'`
      : await tx.$queryRaw<
          Array<{
            membershipId: string;
            classId: string;
            sessionId: string;
            subjectId: null;
          }>
        >`SELECT a."membershipId",a."classId",a."sessionId",NULL AS "subjectId" FROM "FormTeacherResponsibility" a JOIN "Membership" m ON m."schoolId"=a."schoolId" AND m."id"=a."membershipId" AND m."userId"=${u} AND m."isActive" WHERE a."schoolId"=${s} AND a."id"=${d.formResponsibilityId} AND a."status"='ACTIVE'`;
    const c = context[0];
    if (!c) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        authorUserId: string;
        termId: string;
        assignmentId: string | null;
        formResponsibilityId: string | null;
        reason: string;
        policyId: string;
        dueAt: Date;
        submissionsEnabled: boolean;
        imageReferencesEnabled: boolean;
        assetReleaseIds: string[];
        title: string;
        body: string;
      }>
    >`SELECT a.*,v."title",v."body",v."dueAt",v."submissionsEnabled",v."imageReferencesEnabled",ARRAY(SELECT r."assetReleaseId" FROM "LearningAssignmentResource" r WHERE r."schoolId"=a."schoolId" AND r."taskId"=a."id" AND r."revision"=1 ORDER BY r."assetReleaseId") AS "assetReleaseIds" FROM "LearningAssignment" a JOIN "LearningAssignmentRevision" v ON v."schoolId"=a."schoolId" AND v."taskId"=a."id" AND v."revision"=1 WHERE a."schoolId"=${s} AND a."requestKey"=${d.requestKey}::uuid AND phase10_task_author(a)`;
    if (old.length) {
      const o = old[0];
      if (
        o.authorUserId !== u ||
        o.termId !== d.termId ||
        o.assignmentId !== (d.assignmentId ?? null) ||
        o.formResponsibilityId !== (d.formResponsibilityId ?? null) ||
        o.reason !== d.reason ||
        o.title !== d.title ||
        o.body !== d.body ||
        o.policyId !== d.policyId ||
        o.dueAt.getTime() !== new Date(d.dueAt).getTime() ||
        o.submissionsEnabled !== d.submissionsEnabled ||
        o.imageReferencesEnabled !== d.imageReferencesEnabled ||
        JSON.stringify(o.assetReleaseIds) !== JSON.stringify(d.assetReleaseIds)
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const a = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssignment"("id","schoolId","authorUserId","authorMembershipId","classId","sessionId","termId","subjectId","assignmentId","formResponsibilityId","policyId","requestKey","reason") VALUES(${a}::uuid,${s},${u},${c.membershipId},${c.classId},${c.sessionId},${d.termId},${c.subjectId},${d.assignmentId ?? null},${d.formResponsibilityId ?? null},${d.policyId}::uuid,${d.requestKey}::uuid,${d.reason})`;
    await tx.$executeRaw`INSERT INTO "LearningAssignmentRevision"("id","schoolId","taskId","revision","title","body","dueAt","submissionsEnabled","imageReferencesEnabled","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${a}::uuid,1,${d.title},${d.body},${new Date(d.dueAt)},${d.submissionsEnabled},${d.imageReferencesEnabled},${u},${d.requestKey}::uuid,${d.reason})`;
    await attachResources(tx, s, a, 1, u, d.assetReleaseIds);
    return { id: a, replay: false };
  });
}
async function lockAuthor(
  tx: Prisma.TransactionClient,
  s: string,
  a: string,
  u: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "LearningAssignment" a WHERE a."schoolId"=${s} AND a."id"=${a}::uuid AND a."authorUserId"=${u} AND phase10_task_author(a) FOR UPDATE`;
  if (!rows.length) throw new NoticeError("NOT_FOUND");
}
export async function reviseLearningAssignment(
  s: string,
  a: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(a);
  const d = parse(revise, input),
    u = await noticeActor();
  if (
    "assetReleaseIds" in d &&
    d.assetReleaseIds.length &&
    (process.env.PHASE10_ASSETS_ENABLED !== "true" ||
      process.env.PHASE10_LIBRARY_ENABLED !== "true")
  )
    throw new NoticeError("NOT_FOUND");
  return noticeTransaction(async (tx) => {
    await lockAuthor(tx, s, a, u);
    const old = await tx.$queryRaw<
      Array<{
        taskId: string;
        revision: number;
        actorUserId: string;
        title: string;
        body: string;
        reason: string;
        dueAt: Date;
        submissionsEnabled: boolean;
        imageReferencesEnabled: boolean;
        assetReleaseIds: string[];
      }>
    >`SELECT v.*,ARRAY(SELECT r."assetReleaseId" FROM "LearningAssignmentResource" r WHERE r."schoolId"=v."schoolId" AND r."taskId"=v."taskId" AND r."revision"=v."revision" ORDER BY r."assetReleaseId") AS "assetReleaseIds" FROM "LearningAssignmentRevision" v WHERE v."schoolId"=${s} AND v."requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.taskId !== a ||
        o.revision !== d.expectedRevision + 1 ||
        o.actorUserId !== u ||
        o.title !== d.title ||
        o.body !== d.body ||
        o.reason !== d.reason ||
        o.dueAt.getTime() !== new Date(d.dueAt).getTime() ||
        o.submissionsEnabled !== d.submissionsEnabled ||
        o.imageReferencesEnabled !== d.imageReferencesEnabled ||
        JSON.stringify(o.assetReleaseIds) !== JSON.stringify(d.assetReleaseIds)
      )
        throw new NoticeError("CONFLICT");
      return { id: a, replay: true };
    }
    await tx.$executeRaw`INSERT INTO "LearningAssignmentRevision"("id","schoolId","taskId","revision","title","body","dueAt","submissionsEnabled","imageReferencesEnabled","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${a}::uuid,${d.expectedRevision + 1},${d.title},${d.body},${new Date(d.dueAt)},${d.submissionsEnabled},${d.imageReferencesEnabled},${u},${d.requestKey}::uuid,${d.reason})`;
    await attachResources(
      tx,
      s,
      a,
      d.expectedRevision + 1,
      u,
      d.assetReleaseIds,
    );
    return { id: a, replay: false };
  });
}
export async function transitionLearningAssignment(
  s: string,
  a: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(a);
  const d = parse(transition, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
    const permit = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT a."id" FROM "LearningAssignment" a WHERE a."schoolId"=${s} AND a."id"=${a}::uuid AND ((a."authorUserId"=${u} AND phase10_task_author(a)) OR phase10_task_reviewer(a,${u}) OR (${d.action}='WITHDRAW' AND phase10_owner(${s},${u})))`;
    if (!permit.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        taskId: string;
        revision: number;
        action: string;
        actorUserId: string;
        reason: string;
        targetReleaseId: string | null;
      }>
    >`SELECT * FROM "LearningAssignmentEvent" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.taskId !== a ||
        o.revision !== d.expectedRevision ||
        o.action !== d.action ||
        o.actorUserId !== u ||
        o.reason !== d.reason ||
        o.targetReleaseId !== (d.targetReleaseId ?? null)
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const e = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssignmentEvent"("id","schoolId","taskId","revision","action","targetReleaseId","actorUserId","requestKey","reason") VALUES(${e}::uuid,${s},${a}::uuid,${d.expectedRevision},${d.action},${d.targetReleaseId ?? null}::uuid,${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: e, replay: false };
  });
}

async function attachResources(
  tx: Prisma.TransactionClient,
  s: string,
  task: string,
  revision: number,
  u: string,
  ids: string[],
) {
  for (const id of ids)
    await tx.$executeRaw`INSERT INTO "LearningAssignmentResource"("id","schoolId","taskId","revision","assetReleaseId","actorUserId") VALUES(${randomUUID()}::uuid,${s},${task}::uuid,${revision},${id}::uuid,${u})`;
}
const policySchema = z
  .object({
    timeZone: z.string().trim().min(3).max(64),
    allowFormTasks: z.boolean(),
    allowTextSubmissions: z.boolean(),
    allowImageReferences: z.boolean(),
    allowLateSubmissions: z.boolean(),
    allowResubmission: z.boolean(),
    reason,
    requestKey: key,
  })
  .strict()
  .refine(
    (d) =>
      d.allowTextSubmissions ||
      (!d.allowImageReferences &&
        !d.allowLateSubmissions &&
        !d.allowResubmission),
  );
export async function adoptLearningPolicy(s: string, input: unknown) {
  enabled();
  validSchool(s);
  const d = parse(policySchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        timeZone: string;
        allowFormTasks: boolean;
        allowTextSubmissions: boolean;
        allowImageReferences: boolean;
        allowLateSubmissions: boolean;
        allowResubmission: boolean;
        actorUserId: string;
        reason: string;
      }>
    >`SELECT * FROM "LearningAssignmentPolicy" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.actorUserId !== u ||
        o.timeZone !== d.timeZone ||
        o.allowFormTasks !== d.allowFormTasks ||
        o.allowTextSubmissions !== d.allowTextSubmissions ||
        o.allowImageReferences !== d.allowImageReferences ||
        o.allowLateSubmissions !== d.allowLateSubmissions ||
        o.allowResubmission !== d.allowResubmission ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssignmentPolicy"("id","schoolId","version","timeZone","allowFormTasks","allowTextSubmissions","allowImageReferences","allowLateSubmissions","allowResubmission","actorUserId","requestKey","reason") VALUES(${id}::uuid,${s},0,${d.timeZone},${d.allowFormTasks},${d.allowTextSubmissions},${d.allowImageReferences},${d.allowLateSubmissions},${d.allowResubmission},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function readLearningAssignments(s: string, releaseId?: string) {
  enabled();
  validSchool(s);
  if (releaseId) validUuid(releaseId);
  const u = await noticeActor();
  const eligible = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (phase10_recipient(${s},${u},'STUDENTS_ONLY') OR EXISTS(SELECT 1 FROM "LearningAssignment" a WHERE a."schoolId"=${s} AND ((a."authorUserId"=${u} AND phase10_task_author(a)) OR phase10_task_reviewer(a,${u})))) AS allowed`;
  if (!eligible[0]?.allowed) throw new NoticeError("NOT_FOUND");
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      body: string;
      revision: number;
      dueAt: Date;
      timeZone: string;
      submissionsEnabled: boolean;
      imageReferencesEnabled: boolean;
      lateAllowed: boolean;
      submissionWindowOpen: boolean;
      resubmissionAllowed: boolean;
      assetReleaseIds: string[];
    }>
  >(
    Prisma.sql`SELECT e."id",v."title",v."body",v."revision",v."dueAt",policy."timeZone",v."submissionsEnabled",v."imageReferencesEnabled",policy."allowLateSubmissions" AS "lateAllowed",(v."submissionsEnabled" AND policy."allowTextSubmissions" AND (v."dueAt">=clock_timestamp() OR policy."allowLateSubmissions")) AS "submissionWindowOpen",policy."allowResubmission" AS "resubmissionAllowed",ARRAY(SELECT r."assetReleaseId" FROM "LearningAssignmentResource" r WHERE r."schoolId"=e."schoolId" AND r."taskId"=e."taskId" AND r."revision"=e."revision" AND ${process.env.PHASE10_ASSETS_ENABLED === "true" && process.env.PHASE10_LIBRARY_ENABLED === "true"} AND can_read_learning_asset(e."schoolId",r."assetReleaseId",${u}) ORDER BY r."assetReleaseId") AS "assetReleaseIds" FROM "LearningAssignmentEvent" e JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN "LearningAssignmentPolicy" policy ON policy."schoolId"=a."schoolId" AND policy."id"=a."policyId" JOIN "LearningAssignmentRevision" v ON v."schoolId"=e."schoolId" AND v."taskId"=e."taskId" AND v."revision"=e."revision" WHERE e."schoolId"=${s} AND e."action"='RELEASE' AND can_read_learning_assignment(e."schoolId",e."id",${u}) ${releaseId ? Prisma.sql`AND e."id"=${releaseId}::uuid` : Prisma.empty} ORDER BY e."ordinal" DESC LIMIT 100`,
  );
  if (releaseId && !rows.length) throw new NoticeError("NOT_FOUND");
  return { tasks: rows };
}

export async function learningAssignmentWorkspace(
  s: string,
  releaseId?: string,
) {
  enabled();
  validSchool(s);
  if (releaseId) validUuid(releaseId);
  const u = await noticeActor();
  const member = await prisma.membership.findFirst({
    where: {
      schoolId: s,
      userId: u,
      isActive: true,
      school: { isActive: true },
      role: {
        in: [
          "TEACHER",
          "FORM_TEACHER",
          "HEAD_OF_SECTION",
          "PRINCIPAL",
          "STUDENT",
          "SCHOOL_SUPER_ADMIN",
        ],
      },
    },
    select: { role: true },
  });
  if (!member) throw new NoticeError("NOT_FOUND");
  const policy = await prisma.$queryRaw<
    Array<{
      id: string;
      version: number;
      timeZone: string;
      allowFormTasks: boolean;
      allowTextSubmissions: boolean;
      allowImageReferences: boolean;
      allowLateSubmissions: boolean;
      allowResubmission: boolean;
    }>
  >`SELECT "id","version","timeZone","allowFormTasks","allowTextSubmissions","allowImageReferences","allowLateSubmissions","allowResubmission" FROM "LearningAssignmentPolicy" WHERE "schoolId"=${s} AND phase10_owner(${s},"actorUserId") ORDER BY "version" DESC LIMIT 1`;
  const tasks = releaseId
    ? []
    : await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          body: string;
          revision: number;
          dueAt: Date;
          submissionsEnabled: boolean;
          imageReferencesEnabled: boolean;
          timeZone: string;
          policyCurrent: boolean;
          canRelease: boolean;
          assetReleaseIds: string[];
          state: string;
          own: boolean;
          releaseId: string | null;
          releaseRevision: number | null;
        }>
      >`SELECT a."id",v."title",v."body",v."revision",v."dueAt",v."submissionsEnabled",v."imageReferencesEnabled",p."timeZone",a."policyId"=(SELECT "id" FROM "LearningAssignmentPolicy" WHERE "schoolId"=a."schoolId" ORDER BY "version" DESC LIMIT 1) AS "policyCurrent",(v."dueAt">clock_timestamp() AND a."policyId"=(SELECT "id" FROM "LearningAssignmentPolicy" WHERE "schoolId"=a."schoolId" ORDER BY "version" DESC LIMIT 1) AND EXISTS(SELECT 1 FROM "LearningAssignmentEvent" review WHERE review."schoolId"=a."schoolId" AND review."taskId"=a."id" AND review."revision"=v."revision" AND review."action"='APPROVE' AND phase10_task_reviewer(a,review."actorUserId"))) AS "canRelease",ARRAY(SELECT r."assetReleaseId" FROM "LearningAssignmentResource" r WHERE r."schoolId"=a."schoolId" AND r."taskId"=a."id" AND r."revision"=v."revision" AND ${process.env.PHASE10_ASSETS_ENABLED === "true" && process.env.PHASE10_LIBRARY_ENABLED === "true"} AND can_read_learning_asset(a."schoolId",r."assetReleaseId",${u}) ORDER BY r."assetReleaseId") AS "assetReleaseIds",COALESCE(e."action",'DRAFT') AS state,a."authorUserId"=${u} AS own,published."id" AS "releaseId",published."revision" AS "releaseRevision" FROM "LearningAssignment" a JOIN "LearningAssignmentPolicy" p ON p."schoolId"=a."schoolId" AND p."id"=a."policyId" JOIN LATERAL(SELECT * FROM "LearningAssignmentRevision" v WHERE v."schoolId"=a."schoolId" AND v."taskId"=a."id" ORDER BY v."revision" DESC LIMIT 1) v ON true LEFT JOIN LATERAL(SELECT "action" FROM "LearningAssignmentEvent" e WHERE e."schoolId"=a."schoolId" AND e."taskId"=a."id" AND e."revision"=v."revision" ORDER BY e."ordinal" DESC LIMIT 1) e ON true LEFT JOIN LATERAL(SELECT r."id",r."revision" FROM "LearningAssignmentEvent" r WHERE r."schoolId"=a."schoolId" AND r."taskId"=a."id" AND r."action"='RELEASE' AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" newer WHERE newer."schoolId"=r."schoolId" AND newer."taskId"=r."taskId" AND newer."action"='RELEASE' AND newer."ordinal">r."ordinal") AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" w WHERE w."schoolId"=a."schoolId" AND w."targetReleaseId"=r."id") ORDER BY r."ordinal" DESC LIMIT 1) published ON true WHERE a."schoolId"=${s} AND ((a."authorUserId"=${u} AND phase10_task_author(a)) OR (phase10_task_reviewer(a,${u}) AND EXISTS(SELECT 1 FROM "LearningAssignmentEvent" submitted WHERE submitted."schoolId"=a."schoolId" AND submitted."taskId"=a."id" AND submitted."revision"=v."revision" AND submitted."action"='SUBMIT'))) ORDER BY a."createdAt" DESC,a."id" LIMIT 100`;
  const authorities =
    policy.length && !releaseId
      ? await prisma.$queryRaw<
          Array<{ id: string; kind: string; label: string; termId: string }>
        >`SELECT a."id",'SUBJECT' AS kind,c."name" || ' / ' || subject."name" || ' / ' || t."name" AS label,t."id" AS "termId" FROM "TeacherClassSubjectAssignment" a JOIN "Membership" m ON m."schoolId"=a."schoolId" AND m."id"=a."membershipId" AND m."userId"=${u} AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER') JOIN "School" s ON s."id"=a."schoolId" AND s."isActive" JOIN "SchoolClass" c ON c."schoolId"=a."schoolId" AND c."id"=a."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "Subject" subject ON subject."schoolId"=a."schoolId" AND subject."id"=a."subjectId" AND subject."isActive" JOIN "AcademicSession" session ON session."schoolId"=a."schoolId" AND session."id"=a."sessionId" AND session."status"='ACTIVE' JOIN "AcademicTerm" t ON t."schoolId"=a."schoolId" AND t."sessionId"=session."id" AND t."status"='ACTIVE' WHERE a."schoolId"=${s} AND a."status"='ACTIVE'
 UNION ALL SELECT f."id",'FORM' AS kind,c."name" || ' / Form Teacher / ' || t."name" AS label,t."id" AS "termId" FROM "FormTeacherResponsibility" f JOIN "Membership" m ON m."schoolId"=f."schoolId" AND m."id"=f."membershipId" AND m."userId"=${u} AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER') JOIN "School" s ON s."id"=f."schoolId" AND s."isActive" JOIN "SchoolClass" c ON c."schoolId"=f."schoolId" AND c."id"=f."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "AcademicSession" session ON session."schoolId"=f."schoolId" AND session."id"=f."sessionId" AND session."status"='ACTIVE' JOIN "AcademicTerm" t ON t."schoolId"=f."schoolId" AND t."sessionId"=session."id" AND t."status"='ACTIVE' WHERE f."schoolId"=${s} AND f."status"='ACTIVE' AND ${policy[0].allowFormTasks} ORDER BY label,id LIMIT 100`
      : [];
  const feed =
    member.role === "STUDENT" || releaseId
      ? (await readLearningAssignments(s, releaseId)).tasks
      : [];
  const moderation =
    member.role === "SCHOOL_SUPER_ADMIN" && !releaseId
      ? await prisma.$queryRaw<
          Array<{ id: string; taskId: string; revision: number }>
        >`SELECT e."id",e."taskId",e."revision" FROM "LearningAssignmentEvent" e WHERE e."schoolId"=${s} AND e."action"='RELEASE' AND phase10_owner(${s},${u}) AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" w WHERE w."schoolId"=e."schoolId" AND w."targetReleaseId"=e."id") ORDER BY e."ordinal" DESC LIMIT 100`
      : [];
  const resources =
    process.env.PHASE10_ASSETS_ENABLED === "true" &&
    ["TEACHER", "FORM_TEACHER"].includes(member.role)
      ? await prisma.$queryRaw<
          Array<{ id: string; label: string }>
        >`SELECT r."id",v."title" AS label FROM "LearningAssetRelease" r JOIN "PrivateLearningAsset" a ON a."schoolId"=r."schoolId" AND a."id"=r."assetId" JOIN "LibraryCatalogRevision" v ON v."schoolId"=a."schoolId" AND v."entryId"=a."entryId" AND v."revision"=a."revision" WHERE r."schoolId"=${s} AND can_read_learning_asset(${s},r."id",${u}) ORDER BY r."createdAt" DESC,r."id" DESC LIMIT 100`
      : [];
  return {
    role: member.role,
    policy: policy[0] ?? null,
    tasks,
    authorities,
    feed,
    moderation,
    resources,
  };
}

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
} from "./service";
const id = z.string().trim().min(1).max(128),
  key = z.string().uuid(),
  reason = z.string().trim().min(5).max(500);
const text = {
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
  requestKey: key,
  reason,
};
const draft = z
  .object({
    ...text,
    termId: id,
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
  if (process.env.PHASE10_CLASS_ANNOUNCEMENTS_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const d = schema.safeParse(value);
  if (!d.success) throw new NoticeError("INVALID_INPUT");
  return d.data;
}
export async function createClassAnnouncement(s: string, input: unknown) {
  enabled();
  validSchool(s);
  const d = parse(draft, input),
    u = await noticeActor();
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
        title: string;
        body: string;
      }>
    >`SELECT a.*,v."title",v."body" FROM "ClassAnnouncement" a JOIN "ClassAnnouncementRevision" v ON v."schoolId"=a."schoolId" AND v."announcementId"=a."id" AND v."revision"=1 WHERE a."schoolId"=${s} AND a."requestKey"=${d.requestKey}::uuid AND phase10_class_author(a)`;
    if (old.length) {
      const o = old[0];
      if (
        o.authorUserId !== u ||
        o.termId !== d.termId ||
        o.assignmentId !== (d.assignmentId ?? null) ||
        o.formResponsibilityId !== (d.formResponsibilityId ?? null) ||
        o.reason !== d.reason ||
        o.title !== d.title ||
        o.body !== d.body
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const a = randomUUID();
    await tx.$executeRaw`INSERT INTO "ClassAnnouncement"("id","schoolId","authorUserId","authorMembershipId","classId","sessionId","termId","subjectId","assignmentId","formResponsibilityId","requestKey","reason") VALUES(${a}::uuid,${s},${u},${c.membershipId},${c.classId},${c.sessionId},${d.termId},${c.subjectId},${d.assignmentId ?? null},${d.formResponsibilityId ?? null},${d.requestKey}::uuid,${d.reason})`;
    await tx.$executeRaw`INSERT INTO "ClassAnnouncementRevision"("id","schoolId","announcementId","revision","title","body","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${a}::uuid,1,${d.title},${d.body},${u},${d.requestKey}::uuid,${d.reason})`;
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
  >`SELECT "id" FROM "ClassAnnouncement" a WHERE a."schoolId"=${s} AND a."id"=${a}::uuid AND a."authorUserId"=${u} AND phase10_class_author(a) FOR UPDATE`;
  if (!rows.length) throw new NoticeError("NOT_FOUND");
}
export async function reviseClassAnnouncement(
  s: string,
  a: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(a);
  const d = parse(revise, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await lockAuthor(tx, s, a, u);
    const old = await tx.$queryRaw<
      Array<{
        announcementId: string;
        revision: number;
        actorUserId: string;
        title: string;
        body: string;
        reason: string;
      }>
    >`SELECT * FROM "ClassAnnouncementRevision" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.announcementId !== a ||
        o.revision !== d.expectedRevision + 1 ||
        o.actorUserId !== u ||
        o.title !== d.title ||
        o.body !== d.body ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: a, replay: true };
    }
    await tx.$executeRaw`INSERT INTO "ClassAnnouncementRevision"("id","schoolId","announcementId","revision","title","body","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${a}::uuid,${d.expectedRevision + 1},${d.title},${d.body},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: a, replay: false };
  });
}
export async function transitionClassAnnouncement(
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
    >`SELECT a."id" FROM "ClassAnnouncement" a WHERE a."schoolId"=${s} AND a."id"=${a}::uuid AND ((a."authorUserId"=${u} AND phase10_class_author(a)) OR phase10_class_reviewer(a,${u}) OR (${d.action}='WITHDRAW' AND phase10_owner(${s},${u})))`;
    if (!permit.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        announcementId: string;
        revision: number;
        action: string;
        actorUserId: string;
        reason: string;
        targetReleaseId: string | null;
      }>
    >`SELECT * FROM "ClassAnnouncementEvent" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.announcementId !== a ||
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
    await tx.$executeRaw`INSERT INTO "ClassAnnouncementEvent"("id","schoolId","announcementId","revision","action","targetReleaseId","actorUserId","requestKey","reason") VALUES(${e}::uuid,${s},${a}::uuid,${d.expectedRevision},${d.action},${d.targetReleaseId ?? null}::uuid,${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: e, replay: false };
  });
}
export async function readClassAnnouncements(s: string, releaseId?: string) {
  enabled();
  validSchool(s);
  if (releaseId) validUuid(releaseId);
  const u = await noticeActor();
  const eligible = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (phase10_recipient(${s},${u},'STUDENTS_ONLY') OR EXISTS(SELECT 1 FROM "ClassAnnouncement" a WHERE a."schoolId"=${s} AND ((a."authorUserId"=${u} AND phase10_class_author(a)) OR phase10_class_reviewer(a,${u})))) AS allowed`;
  if (!eligible[0]?.allowed) throw new NoticeError("NOT_FOUND");
  const rows = await prisma.$queryRaw<
    Array<{ id: string; title: string; body: string; revision: number }>
  >(
    Prisma.sql`SELECT e."id",v."title",v."body",v."revision" FROM "ClassAnnouncementEvent" e JOIN "ClassAnnouncementRevision" v ON v."schoolId"=e."schoolId" AND v."announcementId"=e."announcementId" AND v."revision"=e."revision" WHERE e."schoolId"=${s} AND e."action"='RELEASE' AND can_read_class_announcement(e."schoolId",e."id",${u}) ${releaseId ? Prisma.sql`AND e."id"=${releaseId}::uuid` : Prisma.empty} ORDER BY e."ordinal" DESC LIMIT 100`,
  );
  if (releaseId && !rows.length) throw new NoticeError("NOT_FOUND");
  return { announcements: rows };
}
export async function classAnnouncementWorkspace(s: string) {
  enabled();
  validSchool(s);
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
  const announcements = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      body: string;
      revision: number;
      state: string;
      own: boolean;
      releaseId: string | null;
      releaseRevision: number | null;
    }>
  >`SELECT a."id",v."title",v."body",v."revision",COALESCE(e."action",'DRAFT') AS state,a."authorUserId"=${u} AS own,(SELECT r."id" FROM "ClassAnnouncementEvent" r WHERE r."schoolId"=a."schoolId" AND r."announcementId"=a."id" AND r."action"='RELEASE' AND NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" w WHERE w."schoolId"=r."schoolId" AND w."targetReleaseId"=r."id") ORDER BY r."ordinal" DESC LIMIT 1) AS "releaseId",(SELECT r."revision" FROM "ClassAnnouncementEvent" r WHERE r."schoolId"=a."schoolId" AND r."announcementId"=a."id" AND r."action"='RELEASE' ORDER BY r."ordinal" DESC LIMIT 1) AS "releaseRevision" FROM "ClassAnnouncement" a JOIN LATERAL(SELECT * FROM "ClassAnnouncementRevision" v WHERE v."schoolId"=a."schoolId" AND v."announcementId"=a."id" ORDER BY v."revision" DESC LIMIT 1) v ON true LEFT JOIN LATERAL(SELECT "action" FROM "ClassAnnouncementEvent" e WHERE e."schoolId"=a."schoolId" AND e."announcementId"=a."id" AND e."revision"=v."revision" ORDER BY "ordinal" DESC LIMIT 1) e ON true WHERE a."schoolId"=${s} AND ((a."authorUserId"=${u} AND phase10_class_author(a)) OR (phase10_class_reviewer(a,${u}) AND EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" submitted WHERE submitted."schoolId"=a."schoolId" AND submitted."announcementId"=a."id" AND submitted."revision"=v."revision" AND submitted."action"='SUBMIT'))) ORDER BY a."createdAt" DESC,a."id" LIMIT 100`;
  const authorities = await prisma.$queryRaw<
    Array<{ id: string; kind: string; label: string; termId: string }>
  >`SELECT a."id",'SUBJECT' AS kind,c."name" || ' / ' || subject."name" || ' / ' || t."name" AS label,t."id" AS "termId" FROM "TeacherClassSubjectAssignment" a JOIN "Membership" m ON m."schoolId"=a."schoolId" AND m."id"=a."membershipId" AND m."userId"=${u} AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER') JOIN "School" s ON s."id"=a."schoolId" AND s."isActive" JOIN "SchoolClass" c ON c."schoolId"=a."schoolId" AND c."id"=a."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "Subject" subject ON subject."schoolId"=a."schoolId" AND subject."id"=a."subjectId" AND subject."isActive" JOIN "AcademicSession" session ON session."schoolId"=a."schoolId" AND session."id"=a."sessionId" AND session."status"='ACTIVE' JOIN "AcademicTerm" t ON t."schoolId"=a."schoolId" AND t."sessionId"=session."id" AND t."status"='ACTIVE' WHERE a."schoolId"=${s} AND a."status"='ACTIVE'
 UNION ALL SELECT f."id",'FORM' AS kind,c."name" || ' / Form Teacher / ' || t."name" AS label,t."id" AS "termId" FROM "FormTeacherResponsibility" f JOIN "Membership" m ON m."schoolId"=f."schoolId" AND m."id"=f."membershipId" AND m."userId"=${u} AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER') JOIN "School" s ON s."id"=f."schoolId" AND s."isActive" JOIN "SchoolClass" c ON c."schoolId"=f."schoolId" AND c."id"=f."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "AcademicSession" session ON session."schoolId"=f."schoolId" AND session."id"=f."sessionId" AND session."status"='ACTIVE' JOIN "AcademicTerm" t ON t."schoolId"=f."schoolId" AND t."sessionId"=session."id" AND t."status"='ACTIVE' WHERE f."schoolId"=${s} AND f."status"='ACTIVE' ORDER BY label,id LIMIT 100`;
  const feed =
    member.role === "STUDENT"
      ? (await readClassAnnouncements(s)).announcements
      : [];
  const moderation =
    member.role === "SCHOOL_SUPER_ADMIN"
      ? await prisma.$queryRaw<
          Array<{ id: string; announcementId: string; revision: number }>
        >`SELECT e."id",e."announcementId",e."revision" FROM "ClassAnnouncementEvent" e WHERE e."schoolId"=${s} AND e."action"='RELEASE' AND phase10_owner(${s},${u}) AND NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" w WHERE w."schoolId"=e."schoolId" AND w."targetReleaseId"=e."id") ORDER BY e."ordinal" DESC LIMIT 100`
      : [];
  const deliveryIssues =
    member.role === "SCHOOL_SUPER_ADMIN"
      ? await prisma.$queryRaw<
          Array<{ eventId: string; state: string; failures: number }>
        >`SELECT "eventId","state","failures" FROM "ClassOutbox" WHERE "schoolId"=${s} AND phase10_owner(${s},${u}) AND "state" IN ('RETRY_WAIT','DEAD_LETTER') ORDER BY "nextAttemptAt","eventId" LIMIT 50`
      : [];
  return {
    role: member.role,
    announcements,
    authorities,
    feed,
    moderation,
    deliveryIssues,
  };
}

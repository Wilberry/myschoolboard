import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  noticeTransaction,
  noticeStaff,
  validSchool,
  validUuid,
} from "@/src/modules/communications/service";
const key = z.string().uuid(),
  identifier = z.string().trim().min(1).max(128),
  reason = z.string().trim().min(5).max(500);
const content = {
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().min(1).max(160),
  publisher: z.string().trim().min(1).max(160),
  isbn: z.string().trim().min(1).max(32).nullable(),
  description: z.string().trim().min(1).max(20000),
  provenance: z.string().trim().min(5).max(1000),
  reason,
  requestKey: key,
};
const createSchema = z
  .object({ ...content, kind: z.enum(["PHYSICAL_BOOK", "DIGITAL_RESOURCE"]) })
  .strict();
const reviseSchema = z
  .object({ ...content, expectedRevision: z.number().int().positive() })
  .strict();
const reviewSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    action: z.enum(["APPROVE", "RETURN"]),
    reason,
    requestKey: key,
  })
  .strict();
const releaseSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    scope: z.enum(["SCHOOL", "SECTION", "CLASS", "STUDENT"]),
    sectionId: identifier.optional(),
    classId: identifier.optional(),
    studentId: identifier.optional(),
    reason,
    requestKey: key,
  })
  .strict()
  .refine((d) =>
    d.scope === "SCHOOL"
      ? !d.sectionId && !d.classId && !d.studentId
      : d.scope === "SECTION"
        ? !!d.sectionId && !d.classId && !d.studentId
        : d.scope === "CLASS"
          ? !!d.classId && !d.sectionId && !d.studentId
          : !!d.studentId && !d.sectionId && !d.classId,
  );
function enabled() {
  if (process.env.PHASE10_LIBRARY_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
function parse<T>(s: z.ZodType<T>, v: unknown): T {
  const p = s.safeParse(v);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  return p.data;
}
const comparable = [
  "title",
  "author",
  "publisher",
  "isbn",
  "description",
  "provenance",
  "reason",
] as const;
function same(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: readonly string[],
) {
  return fields.every((k) => (a[k] ?? null) === (b[k] ?? null));
}
async function curator(tx: Prisma.TransactionClient, s: string, u: string) {
  await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
  const m = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "Membership" WHERE "schoolId"=${s} AND "userId"=${u} AND phase10_catalog_curator(${s},${u},"id")`;
  if (!m.length) throw new NoticeError("NOT_FOUND");
  return m[0].id;
}
export async function createCatalogEntry(s: string, input: unknown) {
  enabled();
  validSchool(s);
  const d = parse(createSchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    const member = await curator(tx, s, u);
    const old = await tx.$queryRaw<
      Array<Record<string, unknown> & { id: string; curatorUserId: string }>
    >`SELECT c.*,v."title",v."author",v."publisher",v."isbn",v."description",v."provenance" FROM "LibraryCatalogEntry" c JOIN "LibraryCatalogRevision" v ON v."schoolId"=c."schoolId" AND v."entryId"=c."id" AND v."revision"=1 WHERE c."schoolId"=${s} AND c."requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (o.curatorUserId !== u || !same(o, d, [...comparable, "kind"]))
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LibraryCatalogEntry"("id","schoolId","curatorUserId","curatorMembershipId","kind","requestKey","reason") VALUES(${id}::uuid,${s},${u},${member},${d.kind},${d.requestKey}::uuid,${d.reason})`;
    await tx.$executeRaw`INSERT INTO "LibraryCatalogRevision"("id","schoolId","entryId","revision","title","author","publisher","isbn","description","provenance","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${id}::uuid,1,${d.title},${d.author},${d.publisher},${d.isbn},${d.description},${d.provenance},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function reviseCatalogEntry(
  s: string,
  id: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(id);
  const d = parse(reviseSchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await curator(tx, s, u);
    const allowed = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "LibraryCatalogEntry" WHERE "schoolId"=${s} AND "id"=${id}::uuid AND "curatorUserId"=${u}`;
    if (!allowed.length) throw new NoticeError("NOT_FOUND");
    const old = await tx.$queryRaw<
      Array<
        Record<string, unknown> & {
          entryId: string;
          actorUserId: string;
          revision: number;
        }
      >
    >`SELECT * FROM "LibraryCatalogRevision" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.entryId !== id ||
        o.actorUserId !== u ||
        o.revision !== d.expectedRevision + 1 ||
        !same(o, d, comparable)
      )
        throw new NoticeError("CONFLICT");
      return { id, replay: true };
    }
    await tx.$executeRaw`INSERT INTO "LibraryCatalogRevision"("id","schoolId","entryId","revision","title","author","publisher","isbn","description","provenance","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${id}::uuid,${d.expectedRevision + 1},${d.title},${d.author},${d.publisher},${d.isbn},${d.description},${d.provenance},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function reviewCatalogEntry(
  s: string,
  id: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(id);
  const d = parse(reviewSchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        entryId: string;
        revision: number;
        actorUserId: string;
        action: string;
        reason: string;
      }>
    >`SELECT * FROM "LibraryCatalogReview" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.entryId !== id ||
        o.revision !== d.expectedRevision ||
        o.actorUserId !== u ||
        o.action !== d.action ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const review = randomUUID();
    await tx.$executeRaw`INSERT INTO "LibraryCatalogReview"("id","schoolId","entryId","revision","action","actorUserId","requestKey","reason") VALUES(${review}::uuid,${s},${id}::uuid,${d.expectedRevision},${d.action},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: review, replay: false };
  });
}
export async function releaseCatalogEntry(
  s: string,
  id: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(id);
  const d = parse(releaseSchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<
        Record<string, unknown> & {
          id: string;
          entryId: string;
          actorUserId: string;
          revision: number;
        }
      >
    >`SELECT * FROM "LibraryCatalogRelease" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.entryId !== id ||
        o.revision !== d.expectedRevision ||
        o.actorUserId !== u ||
        !same(o, d, ["scope", "sectionId", "classId", "studentId", "reason"])
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const r = randomUUID();
    await tx.$executeRaw`INSERT INTO "LibraryCatalogRelease"("id","schoolId","entryId","revision","scope","sectionId","classId","studentId","actorUserId","requestKey","reason") VALUES(${r}::uuid,${s},${id}::uuid,${d.expectedRevision},${d.scope},${d.sectionId ?? null},${d.classId ?? null},${d.studentId ?? null},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: r, replay: false };
  });
}
export async function withdrawCatalogRelease(
  s: string,
  id: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(id);
  const d = parse(z.object({ reason, requestKey: key }).strict(), input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        releaseId: string;
        actorUserId: string;
        reason: string;
      }>
    >`SELECT * FROM "LibraryCatalogWithdrawal" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (o.releaseId !== id || o.actorUserId !== u || o.reason !== d.reason)
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const w = randomUUID();
    await tx.$executeRaw`INSERT INTO "LibraryCatalogWithdrawal"("id","schoolId","releaseId","actorUserId","requestKey","reason") VALUES(${w}::uuid,${s},${id}::uuid,${u},${d.requestKey}::uuid,${d.reason})`;
    return { id: w, replay: false };
  });
}
export async function readLibraryCatalog(s: string, releaseId?: string) {
  enabled();
  validSchool(s);
  if (releaseId) validUuid(releaseId);
  const u = await noticeActor();
  const allowed = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (phase10_recipient(${s},${u},'STAFF_ONLY') OR phase10_recipient(${s},${u},'STUDENTS_ONLY')) AS allowed`;
  if (!allowed[0]?.allowed) throw new NoticeError("NOT_FOUND");
  const entries = await prisma.$queryRaw<
    Array<{
      id: string;
      kind: string;
      title: string;
      author: string;
      publisher: string;
      isbn: string | null;
      description: string;
      revision: number;
      assetReleaseId: string | null;
    }>
  >(
    Prisma.sql`SELECT r."id",c."kind",v."title",v."author",v."publisher",v."isbn",v."description",v."revision",(SELECT ar."id" FROM "LearningAssetRelease" ar JOIN "LearningAssetRights" rights ON rights."schoolId"=ar."schoolId" AND rights."id"=ar."rightsId" WHERE ar."schoolId"=r."schoolId" AND rights."catalogReleaseId"=r."id" AND ${process.env.PHASE10_ASSETS_ENABLED === "true"} AND can_read_learning_asset(r."schoolId",ar."id",${u}) ORDER BY ar."createdAt" DESC,ar."id" DESC LIMIT 1) AS "assetReleaseId" FROM "LibraryCatalogRelease" r JOIN "LibraryCatalogEntry" c ON c."schoolId"=r."schoolId" AND c."id"=r."entryId" JOIN "LibraryCatalogRevision" v ON v."schoolId"=r."schoolId" AND v."entryId"=r."entryId" AND v."revision"=r."revision" WHERE r."schoolId"=${s} AND can_read_library_catalog(${s},r."id",${u}) ${releaseId ? Prisma.sql`AND r."id"=${releaseId}::uuid` : Prisma.empty} ORDER BY r."ordinal" DESC LIMIT 100`,
  );
  if (releaseId && !entries.length) throw new NoticeError("NOT_FOUND");
  return {
    entries: entries.map(({ assetReleaseId, ...e }) => ({
      ...e,
      assetAvailable: !!assetReleaseId,
      downloadHref: assetReleaseId
        ? `/api/schools/${encodeURIComponent(s)}/library/asset-releases/${assetReleaseId}/download`
        : null,
    })),
  };
}

export async function libraryWorkspace(s: string) {
  enabled();
  validSchool(s);
  const u = await noticeActor();
  const feed = await readLibraryCatalog(s);
  const m = await prisma.membership.findFirst({
    where: {
      schoolId: s,
      userId: u,
      isActive: true,
      school: { isActive: true },
    },
    select: { role: true, id: true },
  });
  if (!m) throw new NoticeError("NOT_FOUND");
  const canCurate = [
    "SCHOOL_SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "TEACHER",
    "FORM_TEACHER",
  ].includes(m.role);
  const entries = await prisma.$queryRaw<
    Array<{
      id: string;
      kind: string;
      own: boolean;
      revision: number;
      title: string;
      author: string;
      publisher: string;
      isbn: string | null;
      description: string;
      provenance: string;
      reviewAction: string | null;
      releaseId: string | null;
      withdrawn: boolean;
    }>
  >`SELECT c."id",c."kind",c."curatorUserId"=${u} AS own,v."revision",v."title",v."author",v."publisher",v."isbn",v."description",v."provenance",review."action" AS "reviewAction",released."id" AS "releaseId",EXISTS(SELECT 1 FROM "LibraryCatalogWithdrawal" w WHERE w."schoolId"=c."schoolId" AND w."releaseId"=released."id") AS withdrawn FROM "LibraryCatalogEntry" c JOIN LATERAL(SELECT * FROM "LibraryCatalogRevision" v WHERE v."schoolId"=c."schoolId" AND v."entryId"=c."id" ORDER BY v."revision" DESC LIMIT 1) v ON true LEFT JOIN "LibraryCatalogReview" review ON review."schoolId"=c."schoolId" AND review."entryId"=c."id" AND review."revision"=v."revision" LEFT JOIN "LibraryCatalogRelease" released ON released."schoolId"=c."schoolId" AND released."entryId"=c."id" AND released."revision"=v."revision" WHERE c."schoolId"=${s} AND (phase10_owner(${s},${u}) OR (c."curatorUserId"=${u} AND phase10_catalog_curator(${s},${u},c."curatorMembershipId"))) ORDER BY c."createdAt" DESC,c."id" LIMIT 100`;
  const options =
    m.role === "SCHOOL_SUPER_ADMIN"
      ? await prisma.$queryRaw<
          Array<{ scope: string; id: string; label: string }>
        >`SELECT 'SECTION' AS scope,"id","name" AS label FROM "SchoolSection" WHERE "schoolId"=${s} AND "isActive" AND phase10_owner(${s},${u}) UNION ALL SELECT 'CLASS' AS scope,c."id",c."name" AS label FROM "SchoolClass" c JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" WHERE c."schoolId"=${s} AND c."isActive" AND phase10_owner(${s},${u}) UNION ALL SELECT 'STUDENT' AS scope,"id","admissionNumber" AS label FROM "StudentRecord" WHERE "schoolId"=${s} AND "status"='ENROLLED' AND phase10_owner(${s},${u}) ORDER BY scope,label,id LIMIT 300`
      : [];
  const assetsEnabled = process.env.PHASE10_ASSETS_ENABLED === "true";
  const assets = assetsEnabled
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          entryId: string;
          revision: number;
          own: boolean;
          verdict: string;
          catalogReleaseId: string | null;
          rightsId: string | null;
          releaseId: string | null;
          withdrawn: boolean;
        }>
      >`SELECT a."id",a."entryId",a."revision",a."proposerUserId"=${u} AS own,COALESCE(i."verdict",'PENDING') AS verdict,catalog."id" AS "catalogReleaseId",rights."id" AS "rightsId",released."id" AS "releaseId",EXISTS(SELECT 1 FROM "LearningAssetWithdrawal" w WHERE w."schoolId"=a."schoolId" AND w."releaseId"=released."id") AS withdrawn FROM "PrivateLearningAsset" a JOIN "LibraryCatalogEntry" c ON c."schoolId"=a."schoolId" AND c."id"=a."entryId" LEFT JOIN LATERAL(SELECT "verdict" FROM "LearningAssetInspection" i WHERE i."schoolId"=a."schoolId" AND i."assetId"=a."id" AND i."verdict"<>'PENDING' LIMIT 1) i ON true LEFT JOIN "LibraryCatalogRelease" catalog ON catalog."schoolId"=a."schoolId" AND catalog."entryId"=a."entryId" AND catalog."revision"=a."revision" AND can_read_library_catalog(a."schoolId",catalog."id",${u}) LEFT JOIN LATERAL(SELECT "id" FROM "LearningAssetRights" rights WHERE rights."schoolId"=a."schoolId" AND rights."assetId"=a."id" AND rights."catalogReleaseId"=catalog."id" AND phase10_owner(a."schoolId",rights."actorUserId") AND (rights."expiresAt" IS NULL OR rights."expiresAt">clock_timestamp()) ORDER BY rights."createdAt" DESC,rights."id" DESC LIMIT 1) rights ON true LEFT JOIN "LearningAssetRelease" released ON released."schoolId"=a."schoolId" AND released."assetId"=a."id" AND released."rightsId"=rights."id" WHERE a."schoolId"=${s} AND (phase10_owner(${s},${u}) OR (a."proposerUserId"=${u} AND phase10_catalog_curator(${s},${u},c."curatorMembershipId"))) ORDER BY a."createdAt" DESC,a."id" LIMIT 100`
    : [];
  return {
    role: m.role,
    canCurate,
    entries,
    feed: feed.entries,
    options,
    assetsEnabled,
    assets,
  };
}

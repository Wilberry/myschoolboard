import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import {
  NoticeError,
  noticeActor,
  noticeTransaction,
  noticeStaff,
  validSchool,
  validUuid,
} from "@/src/modules/communications/service";
import {
  privateLearningStore,
  normalizeLearningRaster,
  sha256,
  type PrivateLearningBlobStore,
} from "@/src/modules/files/private-learning-store";
const key = z.string().uuid(),
  reason = z.string().trim().min(5).max(500);
function enabled() {
  if (
    process.env.PHASE10_LIBRARY_ENABLED !== "true" ||
    process.env.PHASE10_ASSETS_ENABLED !== "true"
  )
    throw new NoticeError("NOT_FOUND");
}
function parse<T>(s: z.ZodType<T>, v: unknown): T {
  const p = s.safeParse(v);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  return p.data;
}
async function source(
  tx: Prisma.TransactionClient,
  s: string,
  entry: string,
  u: string,
  expectedRevision?: number,
) {
  await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
  const found = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "LibraryCatalogEntry" WHERE "schoolId"=${s} AND "id"=${entry}::uuid AND "kind"='DIGITAL_RESOURCE' AND "curatorUserId"=${u} AND phase10_catalog_curator(${s},${u},"curatorMembershipId") AND (${expectedRevision ?? null}::integer IS NULL OR EXISTS(SELECT 1 FROM "LibraryCatalogRevision" v WHERE v."schoolId"=${s} AND v."entryId"=${entry}::uuid AND v."revision"=${expectedRevision ?? null} AND NOT EXISTS(SELECT 1 FROM "LibraryCatalogRevision" newer WHERE newer."schoolId"=v."schoolId" AND newer."entryId"=v."entryId" AND newer."revision">v."revision")))`;
  if (!found.length) throw new NoticeError("NOT_FOUND");
}
export async function uploadLearningAsset(
  s: string,
  entry: string,
  input: {
    file: File;
    expectedRevision: unknown;
    reason: unknown;
    requestKey: unknown;
  },
  store: PrivateLearningBlobStore = privateLearningStore,
) {
  enabled();
  validSchool(s);
  validUuid(entry);
  const d = parse(
      z
        .object({
          expectedRevision: z.coerce.number().int().positive().max(2147483646),
          reason,
          requestKey: key,
        })
        .strict(),
      {
        expectedRevision: input.expectedRevision,
        reason: input.reason,
        requestKey: input.requestKey,
      },
    ),
    u = await noticeActor();
  if (
    !(input.file instanceof File) ||
    !["image/png", "image/jpeg"].includes(input.file.type) ||
    !input.file.size ||
    input.file.size > 5 * 1024 * 1024
  )
    throw new NoticeError("INVALID_INPUT");
  const bytes = Buffer.from(await input.file.arrayBuffer()),
    hash = sha256(bytes);
  const old = await noticeTransaction(async (tx) => {
    await source(tx, s, entry, u, d.expectedRevision);
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        entryId: string;
        revision: number;
        proposerUserId: string;
        inputSha256: string;
        inputMime: string;
        reason: string;
      }>
    >`SELECT * FROM "PrivateLearningAsset" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (rows.length) {
      const o = rows[0];
      if (
        o.entryId !== entry ||
        o.revision !== d.expectedRevision ||
        o.proposerUserId !== u ||
        o.inputSha256 !== hash ||
        o.inputMime !== input.file.type ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return o.id;
    }
    const quota = await tx.$queryRaw<
      Array<{ count: string }>
    >`SELECT count(*)::text AS count FROM "PrivateLearningAsset" WHERE "schoolId"=${s} AND "proposerUserId"=${u} AND "createdAt">clock_timestamp()-interval '1 hour'`;
    if (Number(quota[0].count) >= 20) throw new NoticeError("RATE_LIMITED");
    return null;
  });
  if (old) return { id: old, replay: true };
  const blob = await store.putQuarantined(s, bytes),
    asset = randomUUID();
  const winner = await noticeTransaction(async (tx) => {
    await source(tx, s, entry, u, d.expectedRevision);
    const existing = await tx.$queryRaw<
      Array<{
        id: string;
        entryId: string;
        revision: number;
        proposerUserId: string;
        inputSha256: string;
        inputMime: string;
        reason: string;
      }>
    >`SELECT * FROM "PrivateLearningAsset" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (existing.length) {
      const o = existing[0];
      if (
        o.entryId !== entry ||
        o.revision !== d.expectedRevision ||
        o.proposerUserId !== u ||
        o.inputSha256 !== hash ||
        o.inputMime !== input.file.type ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return o.id;
    }
    const quota = await tx.$queryRaw<
      Array<{ count: string }>
    >`SELECT count(*)::text AS count FROM "PrivateLearningAsset" WHERE "schoolId"=${s} AND "proposerUserId"=${u} AND "createdAt">clock_timestamp()-interval '1 hour'`;
    if (Number(quota[0].count) >= 20) throw new NoticeError("RATE_LIMITED");
    await tx.$executeRaw`INSERT INTO "PrivateLearningAsset"("id","schoolId","entryId","revision","proposerUserId","requestKey","inputSha256","inputBytes","inputMime","quarantineBlobId","reason") VALUES(${asset}::uuid,${s},${entry}::uuid,${d.expectedRevision},${u},${d.requestKey}::uuid,${hash},${bytes.length},${input.file.type},${blob}::uuid,${d.reason})`;
    await tx.$executeRaw`INSERT INTO "LearningAssetInspection"("id","schoolId","assetId","verdict","profile") VALUES(${randomUUID()}::uuid,${s},${asset}::uuid,'PENDING','RASTER_PNG_V1')`;
    return asset;
  });
  if (winner !== asset) return { id: winner, replay: true };
  if (process.env.PHASE10_RASTER_INSPECTION_ENABLED !== "true") {
    await noticeTransaction(async (tx) => {
      await source(tx, s, entry, u, d.expectedRevision);
      await tx.$executeRaw`INSERT INTO "LearningAssetInspection"("id","schoolId","assetId","verdict","profile") VALUES(${randomUUID()}::uuid,${s},${asset}::uuid,'ERROR','RASTER_PNG_V1')`;
    });
    return { id: asset, replay: false };
  }
  let normalized: Awaited<ReturnType<typeof normalizeLearningRaster>>;
  try {
    normalized = await normalizeLearningRaster(bytes, input.file.type);
  } catch {
    await noticeTransaction(async (tx) => {
      await source(tx, s, entry, u, d.expectedRevision);
      await tx.$executeRaw`INSERT INTO "LearningAssetInspection"("id","schoolId","assetId","verdict","profile") VALUES(${randomUUID()}::uuid,${s},${asset}::uuid,'REJECTED','RASTER_PNG_V1')`;
    });
    throw new NoticeError("INVALID_INPUT");
  }
  const cleanBlob = await store.promoteClean(s, normalized.data);
  await noticeTransaction(async (tx) => {
    await source(tx, s, entry, u, d.expectedRevision);
    await tx.$executeRaw`INSERT INTO "LearningAssetInspection"("id","schoolId","assetId","verdict","profile","blobId","sha256","bytes","width","height") VALUES(${randomUUID()}::uuid,${s},${asset}::uuid,'CLEAN','RASTER_PNG_V1',${cleanBlob}::uuid,${normalized.sha256},${normalized.bytes},${normalized.width},${normalized.height})`;
  });
  return { id: asset, replay: false };
}
const rightsSchema = z
  .object({
    catalogReleaseId: key,
    basis: z.enum(["OWNED", "LICENSED", "OPEN_LICENSE", "PUBLIC_DOMAIN"]),
    sourceLicense: z.string().trim().min(5).max(1000),
    permittedUse: z.literal("EDUCATIONAL_VIEW_DOWNLOAD"),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
    reason,
    requestKey: key,
  })
  .strict();
export async function attestLearningAssetRights(
  s: string,
  assetId: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(assetId);
  const d = parse(rightsSchema, input),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        assetId: string;
        catalogReleaseId: string;
        basis: string;
        sourceLicense: string;
        permittedUse: string;
        expiresAt: Date | null;
        actorUserId: string;
        reason: string;
      }>
    >`SELECT * FROM "LearningAssetRights" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.assetId !== assetId ||
        o.catalogReleaseId !== d.catalogReleaseId ||
        o.basis !== d.basis ||
        o.sourceLicense !== d.sourceLicense ||
        o.permittedUse !== d.permittedUse ||
        o.actorUserId !== u ||
        o.reason !== d.reason ||
        o.expiresAt?.toISOString() !==
          (d.expiresAt ? new Date(d.expiresAt).toISOString() : undefined)
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssetRights"("id","schoolId","assetId","catalogReleaseId","basis","sourceLicense","permittedUse","expiresAt","actorUserId","requestKey","reason") VALUES(${id}::uuid,${s},${assetId}::uuid,${d.catalogReleaseId}::uuid,${d.basis},${d.sourceLicense},${d.permittedUse},${d.expiresAt ? new Date(d.expiresAt) : null},${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function releaseLearningAsset(
  s: string,
  assetId: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(assetId);
  const d = parse(
      z.object({ rightsId: key, reason, requestKey: key }).strict(),
      input,
    ),
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.$queryRaw<
      Array<{
        id: string;
        assetId: string;
        rightsId: string;
        actorUserId: string;
        reason: string;
      }>
    >`SELECT * FROM "LearningAssetRelease" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.assetId !== assetId ||
        o.rightsId !== d.rightsId ||
        o.actorUserId !== u ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssetRelease"("id","schoolId","assetId","rightsId","actorUserId","requestKey","reason") VALUES(${id}::uuid,${s},${assetId}::uuid,${d.rightsId}::uuid,${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function withdrawLearningAsset(
  s: string,
  releaseId: string,
  input: unknown,
) {
  enabled();
  validSchool(s);
  validUuid(releaseId);
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
    >`SELECT * FROM "LearningAssetWithdrawal" WHERE "schoolId"=${s} AND "requestKey"=${d.requestKey}::uuid`;
    if (old.length) {
      const o = old[0];
      if (
        o.releaseId !== releaseId ||
        o.actorUserId !== u ||
        o.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: o.id, replay: true };
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "LearningAssetWithdrawal"("id","schoolId","releaseId","actorUserId","requestKey","reason") VALUES(${id}::uuid,${s},${releaseId}::uuid,${u},${d.requestKey}::uuid,${d.reason})`;
    return { id, replay: false };
  });
}
export async function readLearningAsset(
  s: string,
  releaseId: string,
  store: PrivateLearningBlobStore = privateLearningStore,
) {
  enabled();
  validSchool(s);
  validUuid(releaseId);
  const u = await noticeActor();
  const current = () =>
    prisma.$queryRaw<
      Array<{ blobId: string; sha256: string; bytes: number }>
    >`SELECT i."blobId",i."sha256",i."bytes" FROM "LearningAssetRelease" r JOIN "LearningAssetInspection" i ON i."schoolId"=r."schoolId" AND i."assetId"=r."assetId" AND i."verdict"='CLEAN' WHERE r."schoolId"=${s} AND r."id"=${releaseId}::uuid AND can_read_learning_asset(${s},r."id",${u})`;
  const source = (await current())[0];
  if (!source) throw new NoticeError("NOT_FOUND");
  let data: Buffer;
  try {
    data = await store.openVersion(
      s,
      source.blobId,
      source.sha256,
      source.bytes,
    );
  } catch {
    throw new NoticeError("NOT_FOUND");
  }
  const latest = (await current())[0];
  if (
    !latest ||
    latest.blobId !== source.blobId ||
    latest.sha256 !== source.sha256 ||
    data.length !== source.bytes ||
    sha256(data) !== source.sha256
  )
    throw new NoticeError("NOT_FOUND");
  return data;
}

export async function authorizeLearningUpload(s: string, entry: string) {
  enabled();
  validSchool(s);
  validUuid(entry);
  const u = await noticeActor();
  await noticeTransaction((tx) => source(tx, s, entry, u));
}

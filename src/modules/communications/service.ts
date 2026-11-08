import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
export class NoticeError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "UNAUTHENTICATED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INTERNAL"
      | "RATE_LIMITED",
  ) {
    super(code);
  }
}
export const audienceSchema = z.enum([
  "STAFF_ONLY",
  "STUDENTS_ONLY",
  "GUARDIANS_ONLY",
  "STUDENTS_AND_GUARDIANS",
]);
const reason = z.string().trim().min(5).max(500),
  key = z.string().uuid(),
  title = z.string().trim().min(1).max(160),
  body = z.string().trim().min(1).max(20000);
const draft = z.object({ title, body, reason, requestKey: key }).strict();
const revision = draft
  .extend({ expectedRevision: z.number().int().min(1) })
  .strict();
const policy = z
  .object({ audience: audienceSchema, reason, requestKey: key })
  .strict();
const workflow = z
  .object({
    action: z.enum(["SUBMIT", "APPROVE", "RETURN"]),
    expectedRevision: z.number().int().min(1),
    reason,
    requestKey: key,
  })
  .strict();
const publication = z
  .object({
    expectedRevision: z.number().int().min(1),
    policyId: key,
    reason,
    requestKey: key,
  })
  .strict();
const withdrawal = z.object({ reason, requestKey: key }).strict();
export function noticesEnabled() {
  if (process.env.PHASE10_NOTICES_ENABLED !== "true")
    throw new NoticeError("NOT_FOUND");
}
export async function noticeActor() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new NoticeError("UNAUTHENTICATED");
  return s.user.id;
}
export function validSchool(s: string) {
  if (!s || s.trim() !== s || s.length > 128)
    throw new NoticeError("INVALID_INPUT");
}
export function validUuid(s: string) {
  if (!key.safeParse(s).success) throw new NoticeError("INVALID_INPUT");
}
export function databaseCode(e: Prisma.PrismaClientKnownRequestError) {
  return String(
    (
      e.meta?.driverAdapterError as
        { cause?: { originalCode?: string } } | undefined
    )?.cause?.originalCode ??
      e.meta?.code ??
      e.code,
  );
}
export async function noticeTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 3; i++)
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
      });
    } catch (e) {
      if (e instanceof NoticeError) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        const sql = databaseCode(e);
        if (
          (["P2002", "P2034"].includes(e.code) ||
            ["40001", "40P01", "23505"].includes(sql)) &&
          i < 2
        )
          continue;
        if (sql === "23503" || e.code === "P2003")
          throw new NoticeError("NOT_FOUND");
        if (
          ["23514", "23505", "40001", "40P01"].includes(sql) ||
          ["P2002", "P2034"].includes(e.code)
        )
          throw new NoticeError("CONFLICT");
      }
      throw new NoticeError("INTERNAL");
    }
  throw new NoticeError("CONFLICT");
}
export async function noticeStaff(
  tx: Prisma.TransactionClient,
  s: string,
  u: string,
  owner = false,
) {
  await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${s} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership" WHERE "schoolId"=${s} AND "userId"=${u} FOR UPDATE`;
  const m = await tx.membership.findFirst({
    where: {
      schoolId: s,
      userId: u,
      isActive: true,
      role: owner
        ? "SCHOOL_SUPER_ADMIN"
        : { in: ["SCHOOL_ADMIN", "SCHOOL_SUPER_ADMIN"] },
      school: { isActive: true },
    },
    select: { id: true, role: true },
  });
  if (!m) throw new NoticeError("NOT_FOUND");
  return m;
}
export async function createNotice(s: string, input: unknown) {
  noticesEnabled();
  validSchool(s);
  const p = draft.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    const m = await noticeStaff(tx, s, u);
    const old = await tx.noticeRevision.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
      include: { notice: true },
    });
    if (old) {
      if (
        old.actorUserId !== u ||
        old.notice.authorUserId !== u ||
        old.title !== d.title ||
        old.body !== d.body ||
        old.reason !== d.reason ||
        old.revision !== 1
      )
        throw new NoticeError("CONFLICT");
      return { id: old.noticeId, revision: old.revision, replay: true };
    }
    const id = randomUUID();
    await tx.notice.create({
      data: { id, schoolId: s, authorUserId: u, authorMembershipId: m.id },
    });
    await tx.noticeRevision.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        noticeId: id,
        revision: 1,
        actorUserId: u,
        ...d,
      },
    });
    return { id, revision: 1, replay: false };
  });
}
export async function reviseNotice(s: string, id: string, input: unknown) {
  noticesEnabled();
  validSchool(s);
  validUuid(id);
  const p = revision.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u);
    const n = await tx.notice.findFirst({
      where: { schoolId: s, id, authorUserId: u },
    });
    if (!n) throw new NoticeError("NOT_FOUND");
    const old = await tx.noticeRevision.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.noticeId !== id ||
        old.actorUserId !== u ||
        old.title !== d.title ||
        old.body !== d.body ||
        old.reason !== d.reason ||
        old.revision !== d.expectedRevision + 1
      )
        throw new NoticeError("CONFLICT");
      return { id, revision: old.revision, replay: true };
    }
    if (n.currentRevision !== d.expectedRevision || n.state === "SUBMITTED")
      throw new NoticeError("CONFLICT");
    await tx.noticeRevision.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        noticeId: id,
        revision: n.currentRevision + 1,
        actorUserId: u,
        title: d.title,
        body: d.body,
        reason: d.reason,
        requestKey: d.requestKey,
      },
    });
    return { id, revision: n.currentRevision + 1, replay: false };
  });
}
export async function decideNotice(s: string, id: string, input: unknown) {
  noticesEnabled();
  validSchool(s);
  validUuid(id);
  const p = workflow.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, d.action !== "SUBMIT");
    const n = await tx.notice.findFirst({
      where: {
        schoolId: s,
        id,
        ...(d.action === "SUBMIT" ? { authorUserId: u } : {}),
      },
    });
    if (!n) throw new NoticeError("NOT_FOUND");
    const old = await tx.noticeWorkflowEvent.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.noticeId !== id ||
        old.actorUserId !== u ||
        old.action !== d.action ||
        old.reason !== d.reason ||
        old.revision !== d.expectedRevision
      )
        throw new NoticeError("CONFLICT");
      return { id, revision: old.revision, replay: true };
    }
    if (
      n.currentRevision !== d.expectedRevision ||
      (d.action === "SUBMIT" ? n.state !== "DRAFT" : n.state !== "SUBMITTED")
    )
      throw new NoticeError("CONFLICT");
    await tx.noticeWorkflowEvent.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        noticeId: id,
        revision: d.expectedRevision,
        action: d.action,
        reason: d.reason,
        requestKey: d.requestKey,
        actorUserId: u,
      },
    });
    return { id, revision: d.expectedRevision, replay: false };
  });
}
export async function createNoticePolicy(s: string, input: unknown) {
  noticesEnabled();
  validSchool(s);
  const p = policy.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.noticePolicyRevision.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.actorUserId !== u ||
        old.audience !== d.audience ||
        old.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: old.id, version: old.version, replay: true };
    }
    const row = await tx.noticePolicyRevision.create({
      data: { id: randomUUID(), schoolId: s, actorUserId: u, version: 0, ...d },
    });
    return { id: row.id, version: row.version, replay: false };
  });
}
export async function publishNotice(s: string, id: string, input: unknown) {
  noticesEnabled();
  validSchool(s);
  validUuid(id);
  const p = publication.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.noticeRelease.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.noticeId !== id ||
        old.actorUserId !== u ||
        old.revision !== d.expectedRevision ||
        old.policyId !== d.policyId ||
        old.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: old.id, noticeId: id, revision: old.revision, replay: true };
    }
    const n = await tx.notice.findFirst({ where: { schoolId: s, id } });
    if (!n) throw new NoticeError("NOT_FOUND");
    if (n.currentRevision !== d.expectedRevision || n.state !== "APPROVED")
      throw new NoticeError("CONFLICT");
    const row = await tx.noticeRelease.create({
      data: {
        id: randomUUID(),
        schoolId: s,
        noticeId: id,
        revision: d.expectedRevision,
        policyId: d.policyId,
        ordinal: 0,
        actorUserId: u,
        requestKey: d.requestKey,
        reason: d.reason,
      },
    });
    return { id: row.id, noticeId: id, revision: row.revision, replay: false };
  });
}
export async function withdrawNotice(
  s: string,
  releaseId: string,
  input: unknown,
) {
  noticesEnabled();
  validSchool(s);
  validUuid(releaseId);
  const p = withdrawal.safeParse(input);
  if (!p.success) throw new NoticeError("INVALID_INPUT");
  const d = p.data,
    u = await noticeActor();
  return noticeTransaction(async (tx) => {
    await noticeStaff(tx, s, u, true);
    const old = await tx.noticeWithdrawal.findUnique({
      where: { schoolId_requestKey: { schoolId: s, requestKey: d.requestKey } },
    });
    if (old) {
      if (
        old.releaseId !== releaseId ||
        old.actorUserId !== u ||
        old.reason !== d.reason
      )
        throw new NoticeError("CONFLICT");
      return { id: old.id, releaseId, replay: true };
    }
    const row = await tx.noticeWithdrawal.create({
      data: { id: randomUUID(), schoolId: s, releaseId, actorUserId: u, ...d },
    });
    return { id: row.id, releaseId, replay: false };
  });
}
export interface ReleasedNotice {
  id: string;
  noticeId: string;
  revision: number;
  title: string;
  body: string;
  createdAt: Date;
}
export async function readNoticeFeed(s: string, releaseId?: string) {
  noticesEnabled();
  validSchool(s);
  if (releaseId !== undefined) validUuid(releaseId);
  const u = await noticeActor();
  const enter = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >`SELECT (phase10_recipient(${s},${u},'STAFF_ONLY') OR phase10_recipient(${s},${u},'STUDENTS_AND_GUARDIANS')) AS allowed`;
  if (!enter[0]?.allowed) throw new NoticeError("NOT_FOUND");
  const rows = await prisma.$queryRaw<ReleasedNotice[]>(
    Prisma.sql`SELECT r."id",r."noticeId",r."revision",v."title",v."body",r."createdAt" FROM "NoticeRelease" r JOIN "NoticeRevision" v ON v."schoolId"=r."schoolId" AND v."noticeId"=r."noticeId" AND v."revision"=r."revision" WHERE r."schoolId"=${s} ${releaseId ? Prisma.sql`AND r."id"=${releaseId}::uuid` : Prisma.empty} AND can_read_notice(r."schoolId",r."id",${u}) ORDER BY r."createdAt" DESC,r."id" LIMIT 100`,
  );
  if (releaseId && !rows.length) throw new NoticeError("NOT_FOUND");
  return rows;
}
export interface ManagedNotice {
  id: string;
  revision: number;
  state: string;
  title: string;
  body: string;
  own: boolean;
  releaseId: string | null;
  withdrawn: boolean;
  publishedRevision: number | null;
}
export async function noticeWorkspace(s: string) {
  noticesEnabled();
  validSchool(s);
  const u = await noticeActor();
  const feed = await readNoticeFeed(s);
  const m = await prisma.membership.findFirst({
    where: {
      schoolId: s,
      userId: u,
      isActive: true,
      school: { isActive: true },
    },
    select: { role: true },
  });
  if (!m) throw new NoticeError("NOT_FOUND");
  const manage = ["SCHOOL_ADMIN", "SCHOOL_SUPER_ADMIN"].includes(m.role);
  const notices = manage
    ? await prisma.$queryRaw<
        ManagedNotice[]
      >`SELECT n."id",n."currentRevision" AS revision,n."state",v."title",v."body",n."authorUserId"=${u} AS own,r."id" AS "releaseId",r."revision" AS "publishedRevision",EXISTS(SELECT 1 FROM "NoticeWithdrawal" w WHERE w."schoolId"=n."schoolId" AND w."releaseId"=r."id") AS withdrawn FROM "Notice" n JOIN "School" school ON school."id"=n."schoolId" AND school."isActive" JOIN "Membership" actor ON actor."schoolId"=n."schoolId" AND actor."userId"=${u} AND actor."isActive" AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN') JOIN "NoticeRevision" v ON v."schoolId"=n."schoolId" AND v."noticeId"=n."id" AND v."revision"=n."currentRevision" LEFT JOIN LATERAL(SELECT x."id",x."revision" FROM "NoticeRelease" x WHERE x."schoolId"=n."schoolId" AND x."noticeId"=n."id" ORDER BY x."ordinal" DESC LIMIT 1) r ON true WHERE n."schoolId"=${s} AND (actor."role"='SCHOOL_SUPER_ADMIN' OR n."authorUserId"=${u}) ORDER BY n."createdAt" DESC,n."id" LIMIT 100`
    : [];
  const policies =
    m.role === "SCHOOL_SUPER_ADMIN"
      ? await prisma.$queryRaw<
          Array<{ id: string; version: number; audience: string }>
        >`SELECT p."id",p."version",p."audience" FROM "NoticePolicyRevision" p WHERE p."schoolId"=${s} AND phase10_owner(p."schoolId",${u}) ORDER BY p."version" DESC LIMIT 100`
      : [];
  const deliveryIssues =
    m.role === "SCHOOL_SUPER_ADMIN"
      ? await prisma.$queryRaw<
          Array<{
            eventId: string;
            state: string;
            failures: number;
            nextAttemptAt: Date;
          }>
        >`SELECT q."eventId",q."state",q."failures",q."nextAttemptAt" FROM "OutboxDispatch" q WHERE q."schoolId"=${s} AND phase10_owner(q."schoolId",${u}) AND q."state" IN ('RETRY_WAIT','DEAD_LETTER') ORDER BY q."nextAttemptAt",q."eventId" LIMIT 50`
      : [];
  return { role: m.role, notices, policies, feed, deliveryIssues };
}

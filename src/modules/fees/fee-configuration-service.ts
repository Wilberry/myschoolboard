import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/** Finance configuration does not constitute a debt, verified payment,
 * refund, receipt, or reconciliation. No student/guardian access here. */
export class FeeError extends Error {
  constructor(readonly code:
    "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "INTERNAL") {
    super(code);
    this.name = "FeeError";
  }
}
const id = z.string().min(1).max(128).refine(v => v === v.trim());
const categoryInput = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  name: z.string().trim().min(3).max(120),
}).strict();
const revisionInput = z.object({
  categoryId: id,
  sessionId: id,
  termId: id,
  scope: z.enum(["SCHOOL", "SECTION", "CLASS"]),
  scopeId: id,
  currency: z.string().regex(/^[A-Z]{3}$/),
  amountMinor: z.string().regex(/^[1-9][0-9]{0,12}$/)
    .refine(v => BigInt(v) <= 1000000000000n),
  reason: z.string().trim().min(5).max(500),
}).strict();

function checkSchoolId(schoolId: string) {
  if (!id.safeParse(schoolId).success) throw new FeeError("INVALID_INPUT");
}
async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new FeeError("UNAUTHENTICATED");
  return session.user.id;
}
async function lockCurrentFinanceAdmin(tx: Prisma.TransactionClient,
  schoolId: string, userId: string) {
  // Preserve lock ordering with school configuration/academic mutations.
  await tx.$queryRaw`SELECT "id" FROM "School"
    WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
  const admin = await tx.membership.findFirst({
    where: {
      schoolId, userId, isActive: true, role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!admin) throw new FeeError("NOT_FOUND");
  return admin.id;
}
function feeFailure(error: unknown): never {
  if (error instanceof FeeError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2034"].includes(String(error.code)))
      throw new FeeError("CONFLICT");
    if (error.code === "P2003" || error.code === "P2004" || error.code === "P2010")
      throw new FeeError("NOT_FOUND");
  }
  throw new FeeError("INTERNAL");
}
export async function createInternalFeeCategory(schoolId: string, input: unknown) {
  checkSchoolId(schoolId);
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const userId = await currentUserId();
  try {
    const category = await prisma.$transaction(async tx => {
      const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
      return tx.feeCategory.create({
        data: {
          id: randomUUID(), schoolId, ...parsed.data,
          actorMembershipId: memberId, actorUserId: userId,
        },
        select: { id: true, schoolId: true, code: true, name: true,
          createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
    return { ...category, status: "CONFIGURATION_ONLY" as const };
  } catch (error) { feeFailure(error); }
}
export async function createInternalFeeStructureRevision(
  schoolId: string, input: unknown,
) {
  checkSchoolId(schoolId);
  const parsed = revisionInput.safeParse(input);
  if (!parsed.success ||
    (parsed.data.scope === "SCHOOL" && parsed.data.scopeId !== schoolId)) {
    throw new FeeError("INVALID_INPUT");
  }
  const userId = await currentUserId();
  try {
    const row = await prisma.$transaction(async tx => {
      const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
      const { categoryId, sessionId, termId, scope, scopeId,
        currency, amountMinor, reason } = parsed.data;
      return tx.feeStructureRevision.create({
        data: {
          id: randomUUID(), schoolId, categoryId, sessionId, termId,
          scope, scopeId,
          sectionId: scope === "SECTION" ? scopeId : null,
          classId: scope === "CLASS" ? scopeId : null,
          currency, amountMinor: BigInt(amountMinor), reason,
          actorMembershipId: memberId, actorUserId: userId,
        },
        select: {
          id: true, schoolId: true, categoryId: true,
          sessionId: true, termId: true, scope: true, scopeId: true,
          currency: true, amountMinor: true, version: true,
          reason: true, createdAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
    // JSON cannot serialize bigint. Keep exact minor units as decimal string.
    return { ...row, amountMinor: row.amountMinor.toString(),
      status: "CONFIGURATION_ONLY" as const };
  } catch (error) { feeFailure(error); }
}

/** Final SQL rereads the actual school/member for every row.
 * School Super Admin only: do not infer that teachers/guardians/platform
 * operators may access financial configuration.
 */
export async function listOwnFeeConfiguration(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
    SELECT true AS "allowed"
    FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN' LIMIT 1`;
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  const categories = await prisma.$queryRaw<Array<{
    id: string; code: string; name: string; createdAt: Date;
  }>>(Prisma.sql`
    SELECT c."id", c."code", c."name", c."createdAt"
    FROM "FeeCategory" c
    JOIN "School" s ON s."id"=c."schoolId" AND s."isActive"=true
    JOIN "Membership" m ON m."schoolId"=s."id"
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN'
    WHERE c."schoolId"=${schoolId}
    ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 200`);
  const revisions = await prisma.$queryRaw<Array<{
    id: string; categoryId: string; sessionId: string; termId: string;
    scope: string; scopeId: string; amountMinor: string; currency: string;
    version: number; reason: string; createdAt: Date;
  }>>(Prisma.sql`
    SELECT r."id", r."categoryId", r."sessionId", r."termId",
      r."scope"::text AS "scope", r."scopeId",
      r."amountMinor"::text AS "amountMinor", r."currency",
      r."version", r."reason", r."createdAt"
    FROM "FeeStructureRevision" r
    JOIN "School" s ON s."id"=r."schoolId" AND s."isActive"=true
    JOIN "Membership" m ON m."schoolId"=s."id"
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN'
    WHERE r."schoolId"=${schoolId}
    ORDER BY r."createdAt" DESC, r."id" DESC LIMIT 200`);
  return { categories, revisions, status: "CONFIGURATION_ONLY" as const };
}

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId,
  currentUserId,
  FeeError,
  feeFailure,
  lockCurrentFinanceAdmin,
  requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";
const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const reason = z.string().trim().min(5).max(500);
export const feeVisibility = z.enum([
  "STAFF_ONLY",
  "GUARDIAN_ONLY",
  "STUDENT_ONLY",
  "STUDENT_AND_GUARDIAN",
]);
const releaseInput = z
  .object({
    obligationId: id,
    requestKey: z.string().uuid(),
    action: z.enum(["PUBLISHED", "WITHDRAWN"]),
    visibility: feeVisibility,
    reason,
  })
  .strict();
const receiptInput = z
  .object({ allocationId: id, requestKey: z.string().uuid(), reason })
  .strict();
export function requireFinancialReads() {
  if (process.env.PHASE9_FINANCIAL_READ_ENABLED !== "true")
    throw new FeeError("NOT_FOUND");
}
function requireWrite(flag: string) {
  requirePhase9FeeWritesEnabled();
  if (process.env[flag] !== "true") throw new FeeError("NOT_FOUND");
}
export async function releaseFeeAccount(schoolId: string, input: unknown) {
  requireWrite("PHASE9_ACCOUNT_RELEASE_ENABLED");
  checkSchoolId(schoolId);
  const parsed = releaseInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const data = parsed.data;
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++)
    try {
      return await prisma.$transaction(
        async (tx) => {
          const actorMembershipId = await lockCurrentFinanceAdmin(
            tx,
            schoolId,
            userId,
          );
          const existing = await tx.feeAccountRelease.findFirst({
            where: { schoolId, requestKey: data.requestKey },
          });
          if (existing) {
            if (
              existing.obligationId !== data.obligationId ||
              existing.action !== data.action ||
              existing.visibility !== data.visibility ||
              existing.reason !== data.reason ||
              existing.actorMembershipId !== actorMembershipId
            )
              throw new FeeError("CONFLICT");
            return {
              id: existing.id,
              obligationId: existing.obligationId,
              revision: existing.revision,
              action: existing.action,
              visibility: existing.visibility,
              replay: true,
            };
          }
          const row = await tx.feeAccountRelease.create({
            data: {
              id: randomUUID(),
              schoolId,
              ...data,
              actorMembershipId,
              actorUserId: userId,
            },
            select: {
              id: true,
              obligationId: true,
              revision: true,
              action: true,
              visibility: true,
              createdAt: true,
            },
          });
          return { ...row, replay: false };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (
        attempt === 0 &&
        e &&
        typeof e === "object" &&
        "code" in e &&
        ["P2002", "P2034"].includes(String(e.code))
      )
        continue;
      feeFailure(e);
    }
  throw new FeeError("CONFLICT");
}
export async function issueFeeReceipt(schoolId: string, input: unknown) {
  requireWrite("PHASE9_RECEIPT_ENABLED");
  checkSchoolId(schoolId);
  const parsed = receiptInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const data = parsed.data,
    userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++)
    try {
      return await prisma.$transaction(
        async (tx) => {
          const actorMembershipId = await lockCurrentFinanceAdmin(
            tx,
            schoolId,
            userId,
          );
          const existing = await tx.feeReceipt.findFirst({
            where: { schoolId, requestKey: data.requestKey },
            select: {
              id: true,
              allocationId: true,
              receiptNumber: true,
              reason: true,
              actorMembershipId: true,
              issuedAt: true,
            },
          });
          if (existing) {
            if (
              existing.allocationId !== data.allocationId ||
              existing.reason !== data.reason ||
              existing.actorMembershipId !== actorMembershipId
            )
              throw new FeeError("CONFLICT");
            return {
              id: existing.id,
              allocationId: existing.allocationId,
              receiptNumber: existing.receiptNumber,
              issuedAt: existing.issuedAt,
              replay: true,
            };
          }
          const allocation = await tx.manualPaymentAllocation.findFirst({
            where: { schoolId, id: data.allocationId },
            select: { obligationId: true },
          });
          if (!allocation) throw new FeeError("NOT_FOUND");
          const row = await tx.feeReceipt.create({
            data: {
              id: randomUUID(),
              schoolId,
              ...data,
              obligationId: allocation.obligationId,
              actorMembershipId,
              actorUserId: userId,
            },
            select: {
              id: true,
              allocationId: true,
              receiptNumber: true,
              issuedAt: true,
            },
          });
          return { ...row, replay: false };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (
        attempt === 0 &&
        e &&
        typeof e === "object" &&
        "code" in e &&
        ["P2002", "P2034"].includes(String(e.code))
      )
        continue;
      feeFailure(e);
    }
  throw new FeeError("CONFLICT");
}
async function accountActor(schoolId: string) {
  requireFinancialReads();
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const member = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      school: { isActive: true },
      role: { in: ["SCHOOL_SUPER_ADMIN", "STUDENT", "PARENT"] },
    },
    select: { role: true },
  });
  if (!member) throw new FeeError("NOT_FOUND");
  return userId;
}
export interface FinancialAccount {
  obligationId: string;
  studentId: string;
  givenName: string;
  familyName: string;
  categoryName: string;
  sessionName: string;
  termName: string;
  currency: string;
  originalChargeMinor: string;
  waivedMinor: string;
  allocatedMinor: string;
  reversedMinor: string;
  remainingMinor: string;
}
/** Minimal current ledger, never a bank settlement claim. Every row is gated in
 * the same SQL statement that projects names and exact minor-unit amounts. */
export async function readFinancialAccounts(
  schoolId: string,
  obligationId?: string,
): Promise<FinancialAccount[]> {
  if (obligationId !== undefined && !id.safeParse(obligationId).success)
    throw new FeeError("INVALID_INPUT");
  const userId = await accountActor(schoolId);
  return prisma.$queryRaw<FinancialAccount[]>(Prisma.sql`
 SELECT b."obligationId",b."studentId",pupil."givenName",pupil."familyName",category."name" AS "categoryName",session."name" AS "sessionName",term."name" AS "termName",b."currency",
  b."originalChargeMinor"::text AS "originalChargeMinor",b."waivedMinor"::text AS "waivedMinor",b."allocatedMinor"::text AS "allocatedMinor",b."reversedMinor"::text AS "reversedMinor",b."remainingMinor"::text AS "remainingMinor"
 FROM "FeeAccountBalance" b
 JOIN "School" school ON school."id"=b."schoolId" AND school."isActive"
 JOIN "Membership" actor ON actor."schoolId"=school."id" AND actor."userId"=${userId} AND actor."isActive"
 JOIN "StudentRecord" pupil ON pupil."schoolId"=b."schoolId" AND pupil."id"=b."studentId"
 JOIN "FeeCategory" category ON category."schoolId"=b."schoolId" AND category."id"=b."categoryId"
 JOIN "AcademicSession" session ON session."schoolId"=b."schoolId" AND session."id"=b."sessionId"
 JOIN "AcademicTerm" term ON term."schoolId"=b."schoolId" AND term."id"=b."termId"
 WHERE b."schoolId"=${schoolId} AND (${obligationId ?? null}::text IS NULL OR b."obligationId"=${obligationId ?? null})
 AND (actor."role"='SCHOOL_SUPER_ADMIN' OR "can_read_fee_account"(b."schoolId",b."obligationId",${userId}))
 ORDER BY b."obligationId" LIMIT 200`);
}
export interface FinancialReceipt {
  id: string;
  obligationId: string;
  receiptNumber: string;
  amountMinor: string;
  currency: string;
  issuedAt: Date;
  schoolName: string;
  givenName: string;
  familyName: string;
  categoryName: string;
  sessionName: string;
  termName: string;
  status:
    "ACTIVE_MANUAL_ALLOCATION_RECEIPT" | "REVERSED_MANUAL_ALLOCATION_RECEIPT";
}
export async function readFinancialReceipts(
  schoolId: string,
  receiptId?: string,
): Promise<FinancialReceipt[]> {
  if (receiptId !== undefined && !id.safeParse(receiptId).success)
    throw new FeeError("INVALID_INPUT");
  const userId = await accountActor(schoolId);
  return prisma.$queryRaw<FinancialReceipt[]>(Prisma.sql`
 SELECT r."id",r."obligationId",r."receiptNumber",r."amountMinor"::text AS "amountMinor",r."currency",r."issuedAt",
 r."snapshot"->>'schoolName' AS "schoolName",r."snapshot"->>'givenName' AS "givenName",r."snapshot"->>'familyName' AS "familyName",r."snapshot"->>'categoryName' AS "categoryName",r."snapshot"->>'sessionName' AS "sessionName",r."snapshot"->>'termName' AS "termName",
 CASE WHEN EXISTS (SELECT 1 FROM "ManualAllocationReversalRequest" request JOIN "ManualAllocationReversalDecision" decision ON decision."schoolId"=request."schoolId" AND decision."requestId"=request."id" AND decision."action"='APPROVED'
 WHERE request."schoolId"=r."schoolId" AND request."allocationId"=r."allocationId") THEN 'REVERSED_MANUAL_ALLOCATION_RECEIPT' ELSE 'ACTIVE_MANUAL_ALLOCATION_RECEIPT' END AS status
 FROM "FeeReceipt" r
 JOIN "School" school ON school."id"=r."schoolId" AND school."isActive"
 JOIN "Membership" actor ON actor."schoolId"=school."id" AND actor."userId"=${userId} AND actor."isActive"
 WHERE r."schoolId"=${schoolId} AND (${receiptId ?? null}::text IS NULL OR r."id"=${receiptId ?? null})
 AND (actor."role"='SCHOOL_SUPER_ADMIN' OR "can_read_fee_account"(r."schoolId",r."obligationId",${userId}))
 ORDER BY r."issuedAt" DESC,r."id" DESC LIMIT 200`);
}
export interface FinanceReport {
  currency: string;
  sessionName: string;
  termName: string;
  obligations: string;
  originalChargeMinor: string;
  waivedMinor: string;
  allocatedMinor: string;
  reversedMinor: string;
  remainingMinor: string;
}
export async function readFinanceReports(
  schoolId: string,
): Promise<FinanceReport[]> {
  requireFinancialReads();
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<
    FinanceReport[]
  >(Prisma.sql`SELECT b."currency",session."name" AS "sessionName",term."name" AS "termName",COUNT(*)::text AS obligations,
 SUM(b."originalChargeMinor")::text AS "originalChargeMinor",SUM(b."waivedMinor")::text AS "waivedMinor",SUM(b."allocatedMinor")::text AS "allocatedMinor",SUM(b."reversedMinor")::text AS "reversedMinor",SUM(b."remainingMinor")::text AS "remainingMinor"
 FROM "FeeAccountBalance" b JOIN "School" s ON s."id"=b."schoolId" AND s."isActive"
 JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive"
 JOIN "AcademicSession" session ON session."schoolId"=b."schoolId" AND session."id"=b."sessionId"
 JOIN "AcademicTerm" term ON term."schoolId"=b."schoolId" AND term."id"=b."termId"
 WHERE b."schoolId"=${schoolId} GROUP BY b."currency",session."id",session."name",term."id",term."name" ORDER BY session."name",term."name",b."currency"`);
}

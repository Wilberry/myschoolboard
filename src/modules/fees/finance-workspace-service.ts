import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId,
  currentUserId,
  FeeError,
  listOwnFeeConfiguration,
} from "./fee-configuration-service";
import { listSchoolPaymentEvidence } from "./payment-reference-service";
import { listFeeAdjustmentProposals } from "./fee-adjustment-proposal-service";
import { listOwnManualAllocationReversals } from "./manual-allocation-reversal-service";
import {
  readFinancialAccounts,
  readFinancialReceipts,
  readFinanceReports,
  requireFinancialReads,
} from "./financial-account-service";
export interface FeeTarget {
  obligationId: string;
  studentId: string;
  givenName: string;
  familyName: string;
  categoryName: string;
  currency: string;
  amountMinor: string;
}
export interface FinanceAllocation {
  id: string;
  verificationId: string;
  obligationId: string;
  amountMinor: string;
  currency: string;
  reversed: boolean;
  receiptId: string | null;
}
export async function getFinanceWorkspace(schoolId: string) {
  requireFinancialReads();
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const member = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: { in: ["SCHOOL_ADMIN", "SCHOOL_SUPER_ADMIN"] },
      school: { isActive: true },
    },
    select: { role: true },
  });
  if (!member) throw new FeeError("NOT_FOUND");
  // Submission targets expose original issued charges to school operational
  // administrators, not other staff's claims, aggregate balances or references.
  const targets = await prisma.$queryRaw<
    FeeTarget[]
  >(Prisma.sql`SELECT o."id" AS "obligationId",o."studentId",p."givenName",p."familyName",c."name" AS "categoryName",o."currency",o."amountMinor"::text AS "amountMinor"
 FROM "FeeObligation" o JOIN "School" s ON s."id"=o."schoolId" AND s."isActive"
 JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
 JOIN "StudentRecord" p ON p."schoolId"=o."schoolId" AND p."id"=o."studentId"
 JOIN "FeeCategory" c ON c."schoolId"=o."schoolId" AND c."id"=o."categoryId"
 WHERE o."schoolId"=${schoolId} ORDER BY o."issuedAt" DESC,o."id" DESC LIMIT 200`);
  const allocations = await prisma.$queryRaw<
    FinanceAllocation[]
  >(Prisma.sql`SELECT a."id",a."verificationId",a."obligationId",a."amountMinor"::text AS "amountMinor",a."currency",receipt."id" AS "receiptId",
 EXISTS(SELECT 1 FROM "ManualAllocationReversalRequest" req JOIN "ManualAllocationReversalDecision" d ON d."schoolId"=req."schoolId" AND d."requestId"=req."id" AND d."action"='APPROVED' WHERE req."schoolId"=a."schoolId" AND req."allocationId"=a."id") AS reversed
 FROM "ManualPaymentAllocation" a JOIN "School" s ON s."id"=a."schoolId" AND s."isActive"
 JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
 JOIN "PaymentEvidence" evidence ON evidence."schoolId"=a."schoolId" AND evidence."id"=a."evidenceId"
 LEFT JOIN "FeeReceipt" receipt ON receipt."schoolId"=a."schoolId" AND receipt."allocationId"=a."id"
 WHERE a."schoolId"=${schoolId} AND (m."role"='SCHOOL_SUPER_ADMIN' OR evidence."submitterMembershipId"=m."id") ORDER BY a."allocatedAt" DESC,a."id" DESC LIMIT 200`);
  const attachments = await prisma.$queryRaw<
    Array<{
      id: string;
      evidenceId: string;
      sizeBytes: number;
      createdAt: Date;
    }>
  >(Prisma.sql`SELECT a."id",a."evidenceId",a."sizeBytes",a."createdAt" FROM "PaymentEvidenceAttachment" a
    JOIN "School" s ON s."id"=a."schoolId" AND s."isActive"
    JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."isActive"
    WHERE a."schoolId"=${schoolId} AND (m."role"='SCHOOL_SUPER_ADMIN' OR (m."role"='SCHOOL_ADMIN' AND a."actorMembershipId"=m."id")) ORDER BY a."createdAt" DESC,a."id" DESC LIMIT 200`);
  const [evidence, adjustments, reversals] = await Promise.all([
    listSchoolPaymentEvidence(schoolId),
    listFeeAdjustmentProposals(schoolId),
    listOwnManualAllocationReversals(schoolId),
  ]);
  if (member.role === "SCHOOL_ADMIN")
    return {
      role: member.role,
      targets,
      attachments,
      allocations,
      evidence,
      adjustments,
      reversals,
      config: null,
      options: null,
      accounts: [],
      receipts: [],
      reports: [],
      releases: [],
    };
  const [config, accounts, receipts, reports] = await Promise.all([
    listOwnFeeConfiguration(schoolId),
    readFinancialAccounts(schoolId),
    readFinancialReceipts(schoolId),
    readFinanceReports(schoolId),
  ]);
  const options = await prisma.$queryRaw<
    Array<{
      kind: string;
      id: string;
      label: string;
      sessionId: string | null;
      classId: string | null;
      studentId: string | null;
    }>
  >(Prisma.sql`
 WITH owner AS (SELECT s."id" FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive" WHERE s."id"=${schoolId} AND s."isActive")
 SELECT 'SESSION' AS kind,s."id",s."name" AS label,s."id" AS "sessionId",NULL::text AS "classId",NULL::text AS "studentId" FROM "AcademicSession" s JOIN owner ON owner."id"=s."schoolId" WHERE s."status" IN ('PLANNED','ACTIVE')
 UNION ALL SELECT 'TERM',t."id",t."name",t."sessionId",NULL::text,NULL::text FROM "AcademicTerm" t JOIN owner ON owner."id"=t."schoolId" WHERE t."status" IN ('PLANNED','ACTIVE')
 UNION ALL SELECT 'SECTION',section."id",section."name",NULL::text,NULL::text,NULL::text FROM "SchoolSection" section JOIN owner ON owner."id"=section."schoolId" WHERE section."isActive"
 UNION ALL SELECT 'CLASS',c."id",c."name",NULL::text,c."id",NULL::text FROM "SchoolClass" c JOIN owner ON owner."id"=c."schoolId" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" WHERE c."isActive"
 UNION ALL SELECT 'ENROLLMENT',enrollment."id",p."givenName"||' '||p."familyName"||' — '||c."name",enrollment."sessionId",c."id",p."id" FROM "StudentEnrollment" enrollment JOIN owner ON owner."id"=enrollment."schoolId"
 JOIN "StudentRecord" p ON p."schoolId"=enrollment."schoolId" AND p."id"=enrollment."studentId" AND p."status"='ENROLLED'
 JOIN "SchoolClass" c ON c."schoolId"=enrollment."schoolId" AND c."id"=enrollment."classId" AND c."isActive"
 WHERE enrollment."status"='ACTIVE' LIMIT 600`);
  const releases = await prisma.$queryRaw<
    Array<{
      id: string;
      obligationId: string;
      revision: number;
      action: string;
      visibility: string;
    }>
  >(
    Prisma.sql`SELECT r."id",r."obligationId",r."revision",r."action",r."visibility" FROM "FeeAccountRelease" r JOIN "School" s ON s."id"=r."schoolId" AND s."isActive" JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive" WHERE r."schoolId"=${schoolId} ORDER BY r."revision" DESC,r."id" DESC LIMIT 200`,
  );
  return {
    role: member.role,
    targets,
    attachments,
    allocations,
    evidence,
    adjustments,
    reversals,
    config,
    options,
    accounts,
    receipts,
    reports,
    releases,
  };
}
export type FinanceWorkspace = Awaited<ReturnType<typeof getFinanceWorkspace>>;

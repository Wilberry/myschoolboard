import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId, currentUserId, FeeError, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";

/** School-owner-only allocation of one separately VERIFIED manual claim.
 * This is a provisional INTERNAL reconciliation preview, not bank settlement,
 * a real PaymentRecord, a receipt or an enforceable published balance. */
const allocateInput = z.object({
  verificationId: z.string().min(1).max(128).refine(v => v === v.trim()),
  requestKey: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
}).strict();

function requireManualAllocationEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_MANUAL_ALLOCATION_ENABLED !== "true") {
    throw new FeeError("NOT_FOUND");
  }
}

export async function allocateReviewedManualClaim(schoolId: string, input: unknown) {
  requireManualAllocationEnabled();
  checkSchoolId(schoolId);
  const parsed = allocateInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { verificationId, requestKey, reason } = parsed.data;
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
        const replay = await tx.manualPaymentAllocation.findFirst({
          where: { schoolId, requestKey },
          select: { id: true, verificationId: true, obligationId: true,
            evidenceId: true, reason: true, allocatorMembershipId: true,
            amountMinor: true, currency: true, allocatedAt: true },
        });
        if (replay) {
          if (replay.verificationId !== verificationId ||
              replay.reason !== reason ||
              replay.allocatorMembershipId !== memberId) throw new FeeError("CONFLICT");
          return {
            id: replay.id, obligationId: replay.obligationId,
            evidenceId: replay.evidenceId, verificationId: replay.verificationId,
            amountMinor: replay.amountMinor.toString(), currency: replay.currency,
            allocatedAt: replay.allocatedAt,
            status: "MANUAL_ALLOCATION_PREVIEW_ONLY" as const, replay: true,
          };
        }
        const decision = await tx.paymentVerificationDecision.findFirst({
          where: { schoolId, id: verificationId, action: "VERIFIED",
            confirmedBankFunds: true },
          select: {
            evidenceId: true, confirmedReferenceDigest: true,
            evidence: { select: {
              id: true, obligationId: true, claimedAmountMinor: true,
              currency: true, referenceDigest: true, submitterMembershipId: true,
              obligation: { select: { amountMinor: true, currency: true } },
            } },
          },
        });
        if (!decision || !decision.evidence ||
            decision.evidence.referenceDigest !== decision.confirmedReferenceDigest ||
            decision.evidence.submitterMembershipId === memberId ||
            decision.evidence.currency !== decision.evidence.obligation.currency)
          throw new FeeError("NOT_FOUND");
        const e = decision.evidence;
        const record = await tx.manualPaymentAllocation.create({
          data: {
            id: randomUUID(), schoolId, obligationId: e.obligationId,
            evidenceId: e.id, verificationId, requestKey,
            amountMinor: e.claimedAmountMinor, currency: e.currency, reason,
            allocatorMembershipId: memberId, allocatorUserId: userId,
          },
          select: { id: true, obligationId: true, evidenceId: true,
            verificationId: true, amountMinor: true, currency: true,
            allocatedAt: true },
        });
        return { ...record, amountMinor: record.amountMinor.toString(),
          status: "MANUAL_ALLOCATION_PREVIEW_ONLY" as const, replay: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
          ["P2002", "P2034"].includes(String(error.code)) && attempt === 0) continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

/** Each row is a consistent statement-time school-bound preview from
 * immutable original debt + reviewed claims + manual allocations.
 * NEVER display as official paid/outstanding. No guardian/student route.
 * Aggregates are decimal text in PostgreSQL: no JS float money maths. */
export async function listManualAllocationPreview(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id"
    FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN' LIMIT 1
  `);
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  const rows = await prisma.$queryRaw<Array<{
    obligationId: string; studentId: string; sessionId: string;
    termId: string; categoryId: string; currency: string;
    originalChargeMinor: string; independentlyReviewedMinor: string;
    manuallyAllocatedMinor: string; reviewedNotAllocatedMinor: string;
    previewRemainingMinor: string;
    previewState: "NO_MANUAL_ALLOCATION" | "PARTIAL_MANUAL_ALLOCATION" |
      "FULL_MANUAL_ALLOCATION";
  }>>(Prisma.sql`
    SELECT charge."id" AS "obligationId", charge."studentId",
      charge."sessionId", charge."termId", charge."categoryId",
      charge."currency",
      charge."amountMinor"::text AS "originalChargeMinor",
      COALESCE(reviewed."reviewedMinor",0)::text AS "independentlyReviewedMinor",
      COALESCE(applied."allocatedMinor",0)::text AS "manuallyAllocatedMinor",
      GREATEST(COALESCE(reviewed."reviewedMinor",0)-
        COALESCE(applied."allocatedMinor",0),0)::text AS "reviewedNotAllocatedMinor",
      GREATEST(charge."amountMinor"::numeric-
        COALESCE(applied."allocatedMinor",0),0)::text AS "previewRemainingMinor",
      CASE
        WHEN COALESCE(applied."allocatedMinor",0)=0 THEN 'NO_MANUAL_ALLOCATION'
        WHEN COALESCE(applied."allocatedMinor",0)=charge."amountMinor"
          THEN 'FULL_MANUAL_ALLOCATION'
        ELSE 'PARTIAL_MANUAL_ALLOCATION' END AS "previewState"
    FROM "FeeObligation" charge
    JOIN "School" s ON s."id"=charge."schoolId" AND s."isActive"=true
    JOIN "Membership" member ON member."schoolId"=s."id"
      AND member."userId"=${userId} AND member."isActive"=true
      AND member."role"='SCHOOL_SUPER_ADMIN'
    LEFT JOIN LATERAL (
      SELECT SUM(e."claimedAmountMinor")::numeric AS "reviewedMinor"
      FROM "PaymentEvidence" e
      JOIN "PaymentVerificationDecision" review
        ON review."schoolId"=e."schoolId" AND review."evidenceId"=e."id"
        AND review."action"='VERIFIED' AND review."confirmedBankFunds"=true
        AND review."confirmedReferenceDigest"=e."referenceDigest"
      WHERE e."schoolId"=charge."schoolId"
        AND e."obligationId"=charge."id" AND e."currency"=charge."currency"
    ) reviewed ON true
    LEFT JOIN LATERAL (
      SELECT SUM(alloc."amountMinor")::numeric AS "allocatedMinor"
      FROM "ManualPaymentAllocation" alloc
      WHERE alloc."schoolId"=charge."schoolId"
        AND alloc."obligationId"=charge."id"
        AND alloc."currency"=charge."currency"
    ) applied ON true
    WHERE charge."schoolId"=${schoolId}
    ORDER BY charge."issuedAt" DESC, charge."id" DESC
    LIMIT 200
  `);
  return { rows, status: "MANUAL_RECONCILIATION_PREVIEW_NOT_OFFICIAL" as const };
}

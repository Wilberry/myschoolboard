import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId, currentUserId, FeeError, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";
import { lockCurrentSubmitter } from "./payment-reference-service";

/** Advisory governance only. Even approved waivers DO NOT reduce fees,
 * mark any account paid, produce a refund, or change the balance preview. */
const id = z.string().min(1).max(128).refine(v => v === v.trim());
const reason = z.string().trim().min(5).max(500);
const proposalInput = z.object({
  obligationId: id, requestKey: z.string().uuid(),
  kind: z.enum(["WAIVER", "CORRECTION_PROPOSAL"]),
  proposedAmountMinor: z.string().regex(/^[1-9][0-9]{0,12}$/)
    .refine(v => BigInt(v) <= 1000000000000n),
  reason,
}).strict();
const decisionInput = z.object({
  proposalId: id,
  action: z.enum(["APPROVED", "REJECTED"]),
  reason,
}).strict();

function requireEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED !== "true")
    throw new FeeError("NOT_FOUND");
}

export async function proposeFeeAdjustment(schoolId: string, input: unknown) {
  requireEnabled();
  checkSchoolId(schoolId);
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { obligationId, requestKey, kind, proposedAmountMinor, reason } = parsed.data;
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const membershipId = await lockCurrentSubmitter(tx, schoolId, userId);
        const existing = await tx.feeAdjustmentProposal.findFirst({
          where: { schoolId, requestKey },
          select: {
            id: true, obligationId: true, kind: true, proposedAmountMinor: true,
            currency: true, reason: true, proposerMembershipId: true,
            proposedAt: true,
          },
        });
        if (existing) {
          if (existing.obligationId !== obligationId ||
            existing.kind !== kind ||
            existing.proposedAmountMinor !== BigInt(proposedAmountMinor) ||
            existing.reason !== reason ||
            existing.proposerMembershipId !== membershipId)
            throw new FeeError("CONFLICT");
          return { id: existing.id, obligationId, kind,
            proposedAmountMinor: existing.proposedAmountMinor.toString(),
            currency: existing.currency, proposedAt: existing.proposedAt,
            status: "ADVISORY_FEE_ADJUSTMENT_PROPOSAL_ONLY" as const,
            replay: true };
        }
        const charge = await tx.feeObligation.findFirst({
          where: { schoolId, id: obligationId },
          select: { amountMinor: true, currency: true },
        });
        if (!charge) throw new FeeError("NOT_FOUND");
        if (BigInt(proposedAmountMinor) > charge.amountMinor)
          throw new FeeError("INVALID_INPUT");
        const created = await tx.feeAdjustmentProposal.create({
          data: { id: randomUUID(), schoolId, obligationId, requestKey,
            kind, proposedAmountMinor: BigInt(proposedAmountMinor),
            currency: charge.currency, reason,
            proposerMembershipId: membershipId, proposerUserId: userId },
          select: { id: true, obligationId: true, kind: true,
            proposedAmountMinor: true, currency: true, proposedAt: true },
        });
        return { ...created,
          proposedAmountMinor: created.proposedAmountMinor.toString(),
          status: "ADVISORY_FEE_ADJUSTMENT_PROPOSAL_ONLY" as const,
          replay: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
        ["P2002", "P2034"].includes(String(error.code)) && attempt === 0) continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

export async function decideFeeAdjustment(schoolId: string, input: unknown) {
  requireEnabled();
  checkSchoolId(schoolId);
  const parsed = decisionInput.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { proposalId, action, reason } = parsed.data;
  const userId = await currentUserId();
  try {
    const result = await prisma.$transaction(async tx => {
      const membershipId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
      const proposal = await tx.feeAdjustmentProposal.findFirst({
        where: { schoolId, id: proposalId },
        select: { proposerMembershipId: true,
          decision: { select: { id: true, proposalId: true, action: true,
            reason: true, reviewerMembershipId: true, decidedAt: true } } },
      });
      if (!proposal || proposal.proposerMembershipId === membershipId)
        throw new FeeError("NOT_FOUND");
      if (proposal.decision) {
        const prior = proposal.decision;
        if (prior.reviewerMembershipId !== membershipId)
          throw new FeeError("NOT_FOUND");
        if (prior.action !== action || prior.reason !== reason)
          throw new FeeError("CONFLICT");
        return { id: prior.id, proposalId, action,
          decidedAt: prior.decidedAt, replay: true };
      }
      const saved = await tx.feeAdjustmentDecision.create({
        data: { id: randomUUID(), schoolId, proposalId, action, reason,
          reviewerMembershipId: membershipId, reviewerUserId: userId },
        select: { id: true, proposalId: true, action: true, decidedAt: true },
      });
      return { ...saved, replay: false };
    }, { isolationLevel: "Serializable" });
    return { ...result, status: "APPROVAL_NOT_EFFECTIVE_FINANCIAL_ADJUSTMENT" as const };
  } catch (error) { feeFailure(error); }
}

export async function listFeeAdjustmentProposals(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const auth = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id" FROM "School" s
    JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LIMIT 1
  `);
  if (auth.length !== 1) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; obligationId: string; kind: string; amountMinor: string;
    currency: string; proposedAt: Date; action: string | null;
    state: string;
  }>>(Prisma.sql`
    SELECT p."id",p."obligationId",p."kind"::text AS "kind",
      p."proposedAmountMinor"::text AS "amountMinor",
      p."currency",p."proposedAt",
      d."action"::text AS "action",
      CASE WHEN d."action"='APPROVED' THEN 'ADVISORY_APPROVED_NOT_APPLIED'
        WHEN d."action"='REJECTED' THEN 'REJECTED'
        ELSE 'PENDING' END AS "state"
    FROM "FeeAdjustmentProposal" p
    JOIN "School" s ON s."id"=p."schoolId" AND s."isActive"=true
    JOIN "Membership" m ON m."schoolId"=s."id"
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LEFT JOIN "FeeAdjustmentDecision" d ON d."schoolId"=p."schoolId"
      AND d."proposalId"=p."id"
    WHERE p."schoolId"=${schoolId}
      AND (m."role"='SCHOOL_SUPER_ADMIN' OR p."proposerMembershipId"=m."id")
    ORDER BY p."proposedAt" DESC,p."id" DESC LIMIT 200
  `);
}

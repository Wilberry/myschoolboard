import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId, currentUserId, FeeError, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";

/** Applies only a previously independently APPROVED WAIVER proposal
 * to an internal charge preview. No funds settlement, bank refund,
 * official student payment status, or receipt is created here. */
const id = z.string().min(1).max(128).refine(v => v === v.trim());
const payload = z.object({
  decisionId: id,
  requestKey: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
}).strict();

function requireEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_EFFECTIVE_WAIVER_ENABLED !== "true")
    throw new FeeError("NOT_FOUND");
}

export async function applyApprovedFeeWaiver(schoolId: string, input: unknown) {
  requireEnabled();
  checkSchoolId(schoolId);
  const parsed = payload.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { decisionId, requestKey, reason } = parsed.data;
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
        const replay = await tx.feeWaiverApplication.findFirst({
          where: { schoolId, requestKey },
          select: { id: true, decisionId: true, obligationId: true,
            proposalId: true, amountMinor: true, currency: true,
            reason: true, applierMembershipId: true, appliedAt: true },
        });
        if (replay) {
          if (replay.decisionId !== decisionId || replay.reason !== reason ||
              replay.applierMembershipId !== memberId)
            throw new FeeError("CONFLICT");
          return {
            id: replay.id, obligationId: replay.obligationId,
            proposalId: replay.proposalId, decisionId: replay.decisionId,
            amountMinor: replay.amountMinor.toString(),
            currency: replay.currency, appliedAt: replay.appliedAt,
            status: "APPLIED_INTERNAL_WAIVER_NOT_SETTLEMENT" as const,
            replay: true,
          };
        }
        const decision = await tx.feeAdjustmentDecision.findFirst({
          where: { schoolId, id: decisionId, action: "APPROVED" },
          select: {
            proposalId: true,
            proposal: { select: { kind: true, obligationId: true,
              proposedAmountMinor: true, currency: true,
              proposerMembershipId: true,
              obligation: { select: { amountMinor: true, currency: true } },
              feeWaiverApplications: { select: { id: true }, take: 1 },
            } },
          },
        });
        if (!decision || !decision.proposal || decision.proposal.kind !== "WAIVER" ||
            decision.proposal.proposerMembershipId === memberId ||
            decision.proposal.feeWaiverApplications.length !== 0 ||
            decision.proposal.currency !== decision.proposal.obligation.currency)
          throw new FeeError("NOT_FOUND");
        const p = decision.proposal;
        const waiver = await tx.feeWaiverApplication.create({
          data: {
            id: randomUUID(), schoolId, decisionId,
            proposalId: decision.proposalId, obligationId: p.obligationId,
            requestKey, amountMinor: p.proposedAmountMinor,
            currency: p.currency, reason,
            applierMembershipId: memberId, applierUserId: userId,
          },
          select: { id: true, obligationId: true, proposalId: true,
            decisionId: true, amountMinor: true, currency: true,
            appliedAt: true },
        });
        return {
          ...waiver, amountMinor: waiver.amountMinor.toString(),
          status: "APPLIED_INTERNAL_WAIVER_NOT_SETTLEMENT" as const,
          replay: false,
        };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
          ["P2002", "P2034"].includes(String(error.code)) && attempt === 0)
        continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

/** Private owner-only audit of applied INTERNAL accounting waivers.
 * Final SQL rechecks currently active school and actor per returned row. */
export async function listAppliedFeeWaivers(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id" FROM "School" s
    JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN' LIMIT 1
  `);
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; obligationId: string; proposalId: string;
    decisionId: string; amountMinor: string; currency: string;
    appliedAt: Date;
  }>>(Prisma.sql`
    SELECT app."id",app."obligationId",app."proposalId",
      app."decisionId",app."amountMinor"::text AS "amountMinor",
      app."currency",app."appliedAt"
    FROM "FeeWaiverApplication" app
    JOIN "School" s ON s."id"=app."schoolId" AND s."isActive"=true
    JOIN "Membership" m ON m."schoolId"=s."id"
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN'
    WHERE app."schoolId"=${schoolId}
    ORDER BY app."appliedAt" DESC,app."id" DESC LIMIT 200
  `);
}

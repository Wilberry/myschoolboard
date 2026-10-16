import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  checkSchoolId, currentUserId, FeeError, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";
import { lockCurrentSubmitter } from "./payment-reference-service";

/** This is a correction of an INTERNAL MANUAL ALLOCATION PREVIEW only:
 * an APPROVED reversal never transfers funds, refunds a guardian,
 * voids the original claim, or creates an official credit. */
const identifier = z.string().min(1).max(128).refine(v => v === v.trim());
const requestSchema = z.object({
  allocationId: identifier,
  requestKey: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
}).strict();
const decisionSchema = z.object({
  requestId: identifier,
  action: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().min(5).max(500),
}).strict();

function requireReversalsEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_MANUAL_REVERSAL_ENABLED !== "true") {
    throw new FeeError("NOT_FOUND");
  }
}

/** Only an active School Administrator can propose reversing an exact
 * school-owned allocation, never an amount or recipient supplied by HTTP. */
export async function proposeManualAllocationReversal(schoolId: string, input: unknown) {
  requireReversalsEnabled();
  checkSchoolId(schoolId);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { allocationId, requestKey, reason } = parsed.data;
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const memberId = await lockCurrentSubmitter(tx, schoolId, userId);
        const existing = await tx.manualAllocationReversalRequest.findFirst({
          where: { schoolId, requestKey },
          select: {
            id: true, allocationId: true, amountMinor: true, currency: true,
            reason: true, requesterMembershipId: true, requestedAt: true,
          },
        });
        if (existing) {
          if (existing.requesterMembershipId !== memberId ||
              existing.allocationId !== allocationId ||
              existing.reason !== reason) throw new FeeError("CONFLICT");
          return { id: existing.id, allocationId: existing.allocationId,
            amountMinor: existing.amountMinor.toString(), currency: existing.currency,
            requestedAt: existing.requestedAt,
            status: "REVERSAL_REQUEST_ONLY" as const, replay: true };
        }
        const allocation = await tx.manualPaymentAllocation.findFirst({
          where: { schoolId, id: allocationId, reversalRequest: null },
          select: { amountMinor: true, currency: true },
        });
        if (!allocation) throw new FeeError("NOT_FOUND");
        const created = await tx.manualAllocationReversalRequest.create({
          data: {
            id: randomUUID(), schoolId, allocationId, requestKey,
            amountMinor: allocation.amountMinor, currency: allocation.currency,
            reason, requesterMembershipId: memberId, requesterUserId: userId,
          },
          select: { id: true, allocationId: true, amountMinor: true,
            currency: true, requestedAt: true },
        });
        return { ...created, amountMinor: created.amountMinor.toString(),
          status: "REVERSAL_REQUEST_ONLY" as const, replay: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
          ["P2002", "P2034"].includes(String(error.code)) && attempt === 0) continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

/** One terminal reviewer decision: only APPROVED subtracts the original
 * manual allocation from subsequent preview arithmetic. Unaltered record
 * remains permanently in history, with original VERIFIED claim intact. */
export async function decideManualAllocationReversal(schoolId: string, input: unknown) {
  requireReversalsEnabled();
  checkSchoolId(schoolId);
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { requestId, action, reason } = parsed.data;
  const userId = await currentUserId();
  try {
    const decision = await prisma.$transaction(async tx => {
      const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
      const request = await tx.manualAllocationReversalRequest.findFirst({
        where: { schoolId, id: requestId },
        select: {
          requesterMembershipId: true,
          decision: { select: { id: true, action: true, reason: true,
            reviewerMembershipId: true, decidedAt: true, requestId: true } },
        },
      });
      if (!request || request.requesterMembershipId === memberId)
        throw new FeeError("NOT_FOUND");
      if (request.decision) {
        const original = request.decision;
        if (original.reviewerMembershipId !== memberId) throw new FeeError("NOT_FOUND");
        if (original.action !== action || original.reason !== reason)
          throw new FeeError("CONFLICT");
        return { id: original.id, requestId: original.requestId,
          action: original.action, decidedAt: original.decidedAt, replay: true };
      }
      const row = await tx.manualAllocationReversalDecision.create({
        data: {
          id: randomUUID(), schoolId, requestId, action, reason,
          reviewerMembershipId: memberId, reviewerUserId: userId,
        },
        select: { id: true, requestId: true, action: true, decidedAt: true },
      });
      return { ...row, replay: false };
    }, { isolationLevel: "Serializable" });
    return { ...decision,
      status: "MANUAL_ALLOCATION_REVERSAL_DECISION_ONLY" as const };
  } catch (error) { feeFailure(error); }
}

/** Same-school private no-store queue. Administrators see only their
 * own requests; School Super Admin sees the bounded review queue.
 * Final SQL independently checks real current actor on every row. */
export async function listOwnManualAllocationReversals(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id" FROM "School" s
    JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LIMIT 1
  `);
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; allocationId: string; amountMinor: string; currency: string;
    requestedAt: Date; reviewAction: "APPROVED" | "REJECTED" | null;
    reversalState: "PENDING_REVERSAL_REVIEW" | "APPROVED_MANUAL_REVERSAL" |
      "REJECTED_MANUAL_REVERSAL";
  }>>(Prisma.sql`
    SELECT req."id",req."allocationId",
      req."amountMinor"::text AS "amountMinor",
      req."currency",req."requestedAt",
      decision."action"::text AS "reviewAction",
      CASE WHEN decision."action"='APPROVED' THEN 'APPROVED_MANUAL_REVERSAL'
        WHEN decision."action"='REJECTED' THEN 'REJECTED_MANUAL_REVERSAL'
        ELSE 'PENDING_REVERSAL_REVIEW' END AS "reversalState"
    FROM "ManualAllocationReversalRequest" req
    JOIN "School" s ON s."id"=req."schoolId" AND s."isActive"=true
    JOIN "Membership" actor ON actor."schoolId"=s."id"
      AND actor."userId"=${userId} AND actor."isActive"=true
      AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LEFT JOIN "ManualAllocationReversalDecision" decision
      ON decision."schoolId"=req."schoolId" AND decision."requestId"=req."id"
    WHERE req."schoolId"=${schoolId}
      AND (actor."role"='SCHOOL_SUPER_ADMIN'
        OR req."requesterMembershipId"=actor."id")
    ORDER BY req."requestedAt" DESC,req."id" DESC LIMIT 200
  `);
}

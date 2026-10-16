import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  FeeError, checkSchoolId, currentUserId, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";

/** Bank statement REFERENCE CLAIM only. No file, PII, scanned image or
 * provider callback is accepted here. Nothing becomes paid on submission. */
const identifier = z.string().min(1).max(128).refine(v => v === v.trim());
const transferReference = z.string().regex(/^[A-Z0-9-]{8,80}$/);
const submitSchema = z.object({
  obligationId: identifier,
  requestKey: z.string().uuid(),
  transferReference,
  claimedAmountMinor: z.string().regex(/^[1-9][0-9]{0,12}$/)
    .refine(v => BigInt(v) <= 1000000000000n),
  reason: z.string().trim().min(5).max(500),
}).strict();
const verifySchema = z.discriminatedUnion("action", [
  z.object({
    evidenceId: identifier,
    action: z.literal("VERIFIED"),
    transferReference,
    fundsConfirmed: z.literal(true),
    reason: z.string().trim().min(5).max(500),
  }).strict(),
  z.object({
    evidenceId: identifier,
    action: z.literal("REJECTED"),
    reason: z.string().trim().min(5).max(500),
  }).strict(),
]);

function requireClaimEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_PAYMENT_EVIDENCE_ENABLED !== "true") {
    throw new FeeError("NOT_FOUND");
  }
}
function requireReviewEnabled() {
  requirePhase9FeeWritesEnabled();
  if (process.env.PHASE9_PAYMENT_REVIEW_ENABLED !== "true") {
    throw new FeeError("NOT_FOUND");
  }
}
/** Same-school salted digest; do not persist or return the raw reference.
 * Prevents accidental reference reuse within a school. This is NOT an
 * authentication factor or proof that a banking transaction happened. */
function digestReference(schoolId: string, value: string) {
  return createHash("sha256").update(schoolId + "\0" + value).digest("hex");
}

async function lockCurrentSubmitter(tx: Prisma.TransactionClient,
  schoolId: string, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "School"
    WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
  const member = await tx.membership.findFirst({
    where: {
      schoolId, userId, role: "SCHOOL_ADMIN", isActive: true,
      school: { isActive: true },
    }, select: { id: true },
  });
  if (!member) throw new FeeError("NOT_FOUND");
  return member.id;
}

const visible = {
  id: true, obligationId: true, claimedAmountMinor: true,
  currency: true, reason: true, submittedAt: true, status: true,
} as const;

/** Reference metadata cannot issue a receipt, paid marker or credit. */
export async function submitInternalPaymentReference(schoolId: string, input: unknown) {
  requireClaimEnabled();
  checkSchoolId(schoolId);
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { obligationId, requestKey, claimedAmountMinor, reason } = parsed.data;
  const digest = digestReference(schoolId, parsed.data.transferReference);
  const userId = await currentUserId();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const memberId = await lockCurrentSubmitter(tx, schoolId, userId);
        const replay = await tx.paymentEvidence.findFirst({
          where: { schoolId, requestKey },
          select: { ...visible, referenceDigest: true, submitterMembershipId: true },
        });
        if (replay) {
          if (replay.submitterMembershipId !== memberId ||
              replay.obligationId !== obligationId ||
              replay.referenceDigest !== digest ||
              replay.claimedAmountMinor !== BigInt(claimedAmountMinor) ||
              replay.reason !== reason) throw new FeeError("CONFLICT");
          return { id: replay.id, obligationId: replay.obligationId,
            claimedAmountMinor: replay.claimedAmountMinor.toString(),
            currency: replay.currency, reason: replay.reason,
            submittedAt: replay.submittedAt, status: "SUBMITTED_EVIDENCE_ONLY" as const,
            replay: true };
        }
        const charge = await tx.feeObligation.findFirst({
          where: { schoolId, id: obligationId },
          select: { amountMinor: true, currency: true },
        });
        if (!charge) throw new FeeError("NOT_FOUND");
        if (BigInt(claimedAmountMinor) > charge.amountMinor)
          throw new FeeError("INVALID_INPUT");
        const created = await tx.paymentEvidence.create({
          data: {
            id: randomUUID(), schoolId, obligationId, requestKey,
            referenceDigest: digest, claimedAmountMinor: BigInt(claimedAmountMinor),
            currency: charge.currency, reason,
            submitterMembershipId: memberId, submitterUserId: userId,
          }, select: visible,
        });
        return { ...created,
          claimedAmountMinor: created.claimedAmountMinor.toString(),
          status: "SUBMITTED_EVIDENCE_ONLY" as const, replay: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
          ["P2002", "P2034"].includes(String(error.code)) && attempt === 0) continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

/** Manual bank reconciliation is an independent, one-time reviewer
 * attestation by an active School Super Admin, never a provider callback.
 * Rejection does not create credit. Review decisions cannot be edited. */
export async function decideInternalPaymentReference(schoolId: string, input: unknown) {
  requireReviewEnabled();
  checkSchoolId(schoolId);
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const userId = await currentUserId();
  const choice = parsed.data;
  try {
    const decision = await prisma.$transaction(async tx => {
      const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
      const claim = await tx.paymentEvidence.findFirst({
        where: { schoolId, id: choice.evidenceId },
        select: { id: true, referenceDigest: true, submitterMembershipId: true,
          verification: { select: { id: true } } },
      });
      if (!claim || claim.verification || claim.submitterMembershipId === memberId) {
        throw new FeeError("NOT_FOUND");
      }
      const digest = choice.action === "VERIFIED"
        ? digestReference(schoolId, choice.transferReference) : null;
      if (choice.action === "VERIFIED" && digest !== claim.referenceDigest)
        throw new FeeError("NOT_FOUND");
      return tx.paymentVerificationDecision.create({
        data: {
          id: randomUUID(), schoolId, evidenceId: choice.evidenceId,
          action: choice.action, confirmedBankFunds: choice.action === "VERIFIED",
          confirmedReferenceDigest: digest,
          reason: choice.reason, reviewerMembershipId: memberId,
          reviewerUserId: userId,
        },
        select: { id: true, evidenceId: true, action: true,
          reason: true, decidedAt: true },
      });
    }, { isolationLevel: "Serializable" });
    return { ...decision, status: "INDEPENDENT_MANUAL_REVIEW_ONLY" as const };
  } catch (error) { feeFailure(error); }
}

/** School Admin sees only their own submissions, current School Super Admin
 * sees bounded review queue. A missing role is always concealed, even when
 * the school has zero claims. No reference digest or financial PII returned. */
export async function listSchoolPaymentEvidence(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id" FROM "Membership" m
    JOIN "School" s ON s."id"=m."schoolId" AND s."isActive"=true
    WHERE s."id"=${schoolId} AND m."userId"=${userId}
      AND m."isActive"=true AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LIMIT 1
  `);
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; obligationId: string; claimedAmountMinor: string;
    currency: string; submittedAt: Date; reviewAction: string | null;
  }>>(Prisma.sql`
    SELECT evidence."id", evidence."obligationId",
      evidence."claimedAmountMinor"::text AS "claimedAmountMinor",
      evidence."currency", evidence."submittedAt",
      review."action"::text AS "reviewAction"
    FROM "PaymentEvidence" evidence
    JOIN "School" s ON s."id"=evidence."schoolId" AND s."isActive"=true
    JOIN "Membership" actor ON actor."schoolId"=s."id"
      AND actor."userId"=${userId} AND actor."isActive"=true
      AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
    LEFT JOIN "PaymentVerificationDecision" review
      ON review."schoolId"=evidence."schoolId" AND review."evidenceId"=evidence."id"
    WHERE evidence."schoolId"=${schoolId}
      AND (actor."role"='SCHOOL_SUPER_ADMIN'
        OR evidence."submitterMembershipId"=actor."id")
    ORDER BY evidence."submittedAt" DESC, evidence."id" DESC LIMIT 200
  `);
}

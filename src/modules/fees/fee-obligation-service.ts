import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  FeeError, checkSchoolId, currentUserId, feeFailure,
  lockCurrentFinanceAdmin, requirePhase9FeeWritesEnabled,
} from "./fee-configuration-service";

/** Explicit school owner issuance of one immutable charge. This is never a
 * payment or receipt. Database SQL re-derives all identity and money fields. */
const inputSchema = z.object({
  enrollmentId: z.string().min(1).max(128).refine(v => v.trim() === v),
  revisionId: z.string().min(1).max(128).refine(v => v.trim() === v),
  requestKey: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
}).strict();

export async function issueInternalFeeObligation(schoolId: string, input: unknown) {
  requirePhase9FeeWritesEnabled();
  checkSchoolId(schoolId);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new FeeError("INVALID_INPUT");
  const { enrollmentId, revisionId, requestKey, reason } = parsed.data;
  const userId = await currentUserId();
  // A serialization retry is safe because requestKey and pupil/category/term
  // are unique, SQL serializes on School, and historical charges never UPDATE.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const memberId = await lockCurrentFinanceAdmin(tx, schoolId, userId);
        const replay = await tx.feeObligation.findFirst({
          where: { schoolId, requestKey },
          select: { id: true, enrollmentId: true, revisionId: true,
            reason: true, studentId: true, classId: true, sessionId: true,
            termId: true, categoryId: true, amountMinor: true, currency: true,
            issuedAt: true },
        });
        if (replay) {
          if (replay.enrollmentId !== enrollmentId || replay.revisionId !== revisionId ||
              replay.reason !== reason) throw new FeeError("CONFLICT");
          return { ...replay, amountMinor: replay.amountMinor.toString(),
            replay: true, status: "ISSUED_UNPAID" as const };
        }
        const enrollment = await tx.studentEnrollment.findFirst({
          where: { schoolId, id: enrollmentId, status: "ACTIVE",
            student: { status: "ENROLLED" },
            schoolClass: { isActive: true, section: { isActive: true } },
            session: { status: { in: ["PLANNED", "ACTIVE"] } },
          },
          select: { studentId: true, classId: true, sessionId: true,
            schoolClass: { select: { sectionId: true } } },
        });
        const revision = await tx.feeStructureRevision.findFirst({
          where: { schoolId, id: revisionId,
            session: { status: { in: ["PLANNED", "ACTIVE"] } },
            term: { status: { in: ["PLANNED", "ACTIVE"] } },
          },
          select: { categoryId: true, sessionId: true, termId: true,
            scope: true, scopeId: true, amountMinor: true, currency: true },
        });
        if (!enrollment || !revision ||
            enrollment.sessionId !== revision.sessionId ||
            !(
              (revision.scope === "SCHOOL" && revision.scopeId === schoolId) ||
              (revision.scope === "SECTION" &&
                revision.scopeId === enrollment.schoolClass.sectionId) ||
              (revision.scope === "CLASS" && revision.scopeId === enrollment.classId)
            )) throw new FeeError("NOT_FOUND");

        const record = await tx.feeObligation.create({
          data: {
            id: randomUUID(), schoolId, enrollmentId,
            studentId: enrollment.studentId, classId: enrollment.classId,
            sessionId: revision.sessionId, termId: revision.termId,
            categoryId: revision.categoryId, revisionId,
            // SQL overwrites money and identity with trusted joined data.
            amountMinor: revision.amountMinor, currency: revision.currency,
            requestKey, reason, issuerMembershipId: memberId,
            issuerUserId: userId,
          },
          select: { id: true, enrollmentId: true, revisionId: true,
            reason: true, studentId: true, classId: true, sessionId: true,
            termId: true, categoryId: true, amountMinor: true, currency: true,
            issuedAt: true },
        });
        return { ...record, amountMinor: record.amountMinor.toString(),
          replay: false, status: "ISSUED_UNPAID" as const };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error &&
          ["P2002", "P2034"].includes(String(error.code)) && attempt === 0) continue;
      feeFailure(error);
    }
  }
  throw new FeeError("CONFLICT");
}

/** Financial metadata read only. No payment, balance, guardian or student
 * route. The final query repeats actual active same-school owner checks. */
export async function listOwnFeeObligations(schoolId: string) {
  checkSchoolId(schoolId);
  const userId = await currentUserId();
  const allowed = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
    SELECT true AS "allowed"
    FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id"
    WHERE s."id"=${schoolId} AND s."isActive"=true
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN' LIMIT 1`;
  if (allowed.length !== 1) throw new FeeError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; studentId: string; enrollmentId: string; classId: string;
    sessionId: string; termId: string; categoryId: string; revisionId: string;
    amountMinor: string; currency: string; issuedAt: Date;
  }>>(Prisma.sql`
    SELECT o."id", o."studentId", o."enrollmentId", o."classId",
      o."sessionId", o."termId", o."categoryId", o."revisionId",
      o."amountMinor"::text AS "amountMinor", o."currency", o."issuedAt"
    FROM "FeeObligation" o
    JOIN "School" s ON s."id"=o."schoolId" AND s."isActive"=true
    JOIN "Membership" m ON m."schoolId"=s."id"
      AND m."userId"=${userId} AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN'
    WHERE o."schoolId"=${schoolId}
    ORDER BY o."issuedAt" DESC, o."id" DESC LIMIT 200
  `);
}

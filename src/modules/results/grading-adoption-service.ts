import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentFailure,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((x) => x.trim() === x);
const request = z
  .object({
    policyId: identifier,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

/** One explicit school-owner grading adoption event, not result publication.
 * SQL independently checks exact actor/academic context and serializes
 * adoption ordinal. Later policy adoption cannot mutate earlier events. */
export async function adoptResultGradingPolicy(
  schoolId: string,
  input: unknown,
) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = request.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        const actor = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            role: "SCHOOL_SUPER_ADMIN",
            isActive: true,
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!actor) throw new AssessmentError("NOT_FOUND");
        const policy = await tx.assessmentGradingPolicyRevision.findFirst({
          where: {
            schoolId,
            id: parsed.data.policyId,
            session: { status: "ACTIVE" },
            term: { status: "ACTIVE" },
            schoolClass: { isActive: true, section: { isActive: true } },
            subject: { isActive: true },
          },
          select: {
            id: true,
            sessionId: true,
            termId: true,
            classId: true,
            subjectId: true,
          },
        });
        if (!policy) throw new AssessmentError("NOT_FOUND");
        return tx.resultGradingAdoption.create({
          data: {
            id: randomUUID(),
            schoolId,
            policyId: policy.id,
            sessionId: policy.sessionId,
            termId: policy.termId,
            classId: policy.classId,
            subjectId: policy.subjectId,
            reason: parsed.data.reason,
            actorMembershipId: actor.id,
            actorUserId: userId,
          },
          select: {
            id: true,
            policyId: true,
            sessionId: true,
            termId: true,
            classId: true,
            subjectId: true,
            ordinal: true,
            reason: true,
            adoptedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    assessmentFailure(error);
  }
}

/** Restricted bounded policy and adoption history for same-school owner.
 * Do not return student records or any key material. */
export async function listOwnGradingAdoptions(schoolId: string) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const allowed = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!allowed) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      policyId: string;
      sessionId: string;
      termId: string;
      classId: string;
      subjectId: string;
      ordinal: number;
      policyVersion: number;
      quizWeight: number;
      testWeight: number;
      examWeight: number;
      reason: string;
      adoptedAt: Date;
    }>
  >(Prisma.sql`
    SELECT adoption."id", adoption."policyId", adoption."sessionId",
      adoption."termId", adoption."classId", adoption."subjectId",
      adoption."ordinal", policy."version" AS "policyVersion",
      policy."quizWeight", policy."testWeight", policy."examWeight",
      adoption."reason", adoption."adoptedAt"
    FROM "ResultGradingAdoption" adoption
    JOIN "AssessmentGradingPolicyRevision" policy
      ON policy."schoolId"=adoption."schoolId"
      AND policy."id"=adoption."policyId"
    JOIN "School" school ON school."id"=adoption."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN' AND owner."isActive"=true
    WHERE adoption."schoolId"=${schoolId}
    ORDER BY adoption."adoptedAt" DESC, adoption."id" DESC LIMIT 200
  `);
}

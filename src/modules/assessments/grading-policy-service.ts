import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";
import { validateGradingWeights } from "./grading-policy";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((s) => s.trim() === s);
const schema = z
  .object({
    sessionId: id,
    termId: id,
    classId: id,
    subjectId: id,
    quizWeight: z.number().int().min(0).max(100),
    testWeight: z.number().int().min(0).max(100),
    examWeight: z.number().int().min(0).max(100),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .refine((v) => validateGradingWeights(v), {
    message: "Quiz/test/exam weights must total exactly 100",
  });
function schoolIdOrThrow(value: string) {
  if (!id.safeParse(value).success) throw new AssessmentError("INVALID_INPUT");
}

/** Admin authoring of an append-only DRAFT policy only. It is never adopted
 * automatically as an official result, report-card grade, or publication.
 * SQL independently verifies actor/school/class/term and assigns revision.
 */
export async function createInternalGradingPolicyRevision(
  schoolId: string,
  input: unknown,
) {
  schoolIdOrThrow(schoolId);
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
        const admin = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            isActive: true,
            role: "SCHOOL_SUPER_ADMIN",
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!admin) throw new AssessmentError("NOT_FOUND");
        const v = parsed.data;
        const created = await tx.assessmentGradingPolicyRevision.create({
          data: {
            id: randomUUID(),
            schoolId,
            sessionId: v.sessionId,
            termId: v.termId,
            classId: v.classId,
            subjectId: v.subjectId,
            quizWeight: v.quizWeight,
            testWeight: v.testWeight,
            examWeight: v.examWeight,
            reason: v.reason,
            actorMembershipId: admin.id,
            actorUserId: userId,
          },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            termId: true,
            classId: true,
            subjectId: true,
            version: true,
            quizWeight: true,
            testWeight: true,
            examWeight: true,
            reason: true,
            createdAt: true,
          },
        });
        return { ...created, status: "DRAFT_PREVIEW_ONLY" as const };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof AssessmentError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2034" || error.code === "P2002") {
        throw new AssessmentError("CONFLICT");
      }
      if (
        error.code === "P2010" &&
        "meta" in error &&
        error.meta &&
        typeof error.meta === "object" &&
        "code" in error.meta &&
        error.meta.code === "23503"
      ) {
        throw new AssessmentError("NOT_FOUND");
      }
    }
    throw new AssessmentError("INTERNAL");
  }
}

/** No student PII. Current school super admin can review revision histories,
 * never update/delete/activate an existing revision. */
export async function listOwnGradingPolicyRevisions(schoolId: string) {
  schoolIdOrThrow(schoolId);
  const userId = await assessmentUserId();
  const admin = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!admin) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      sessionId: string;
      termId: string;
      classId: string;
      subjectId: string;
      version: number;
      quizWeight: number;
      testWeight: number;
      examWeight: number;
      reason: string;
      createdAt: Date;
    }>
  >(Prisma.sql`
    SELECT policy."id", policy."sessionId", policy."termId",
      policy."classId", policy."subjectId", policy."version",
      policy."quizWeight", policy."testWeight", policy."examWeight",
      policy."reason", policy."createdAt"
    FROM "AssessmentGradingPolicyRevision" policy
    JOIN "School" school ON school."id"=policy."schoolId"
      AND school."isActive"=true
    JOIN "Membership" admin ON admin."schoolId"=school."id"
      AND admin."userId"=${userId} AND admin."isActive"=true
      AND admin."role"='SCHOOL_SUPER_ADMIN'
    WHERE policy."schoolId"=${schoolId}
    ORDER BY policy."createdAt" DESC, policy."id" DESC
    LIMIT 200
  `);
}

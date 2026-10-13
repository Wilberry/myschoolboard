import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

/** Policy options for a FUTURE, separately audited report release.
 * They do not make an existing private report accessible to anyone.
 * The parent-first acknowledgment decision P-004 remains unresolved. */
export const reportVisibilityModes = [
  "ASSESSMENT_ONLY",
  "GUARDIAN_AFTER_RELEASE",
  "STUDENT_AFTER_RELEASE",
  "GUARDIAN_AND_STUDENT_AFTER_RELEASE",
] as const;

const id = z.string().min(1).max(128).refine((value) => value.trim() === value);
const inputSchema = z
  .object({
    recipientMode: z.enum(reportVisibilityModes),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

function visibilityError(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

export async function adoptSchoolReportVisibilityPolicy(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
          WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        const owner = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            isActive: true,
            role: "SCHOOL_SUPER_ADMIN",
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!owner) throw new AssessmentError("NOT_FOUND");
        // Explicit mode is a configuration choice, NOT a grade-release
        // decision or parent/student relationship authorization.
        return tx.reportVisibilityPolicyRevision.create({
          data: {
            id: randomUUID(),
            schoolId,
            recipientMode: parsed.data.recipientMode,
            reason: parsed.data.reason,
            actorMembershipId: owner.id,
            actorUserId: userId,
          },
          select: {
            id: true,
            version: true,
            recipientMode: true,
            reason: true,
            adoptedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    visibilityError(error);
  }
}

/** Bounded owner-only school configuration metadata. No pupil result read. */
export async function listSchoolReportVisibilityPolicies(schoolId: string) {
  if (!id.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      version: number;
      recipientMode: string;
      reason: string;
      adoptedAt: Date;
    }>
  >(Prisma.sql`
    SELECT policy."id",policy."version",policy."recipientMode",
      policy."reason",policy."adoptedAt"
    FROM "ReportVisibilityPolicyRevision" policy
    JOIN "School" school ON school."id"=policy."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE policy."schoolId"=${schoolId}
    ORDER BY policy."version" DESC LIMIT 100
  `);
}

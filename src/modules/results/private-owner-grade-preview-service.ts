import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z.string().min(1).max(128).refine((value) => value.trim() === value);
const inputSchema = z.object({
  compositionId: identifier,
  studentId: identifier,
  reason: z.string().trim().min(5).max(500),
}).strict();

function mapError(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

export type OwnerGradePreview = {
  status: "PRIVATE_OWNER_PREVIEW_NOT_RELEASED";
  student: { givenName: string; familyName: string; admissionNumber: string };
  schoolName: string;
  academic: { session: string; term: string; class: string; subject: string };
  assessmentWeights: { QUIZ: number; TEST: number; EXAM: number };
  categoryPercentBps: { QUIZ: number | null; TEST: number | null; EXAM: number | null };
  rawPercentBps: number;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  evidenceRevision: number;
  gradeScaleVersion: number;
  aggregationRuleVersion: number;
};

/** Records every one-student grade preview in the same transaction.
 * Neither a final result release nor a recipient-grade reader.
 * SQL independently validates exact current school, owner, original teacher,
 * reviewer, marks, policies, roster and full recomputed grade composition.
 */
export async function previewPrivateOwnerStudentGrade(
  schoolId: string,
  input: unknown,
): Promise<{ preview: OwnerGradePreview; audit: {
  id: string; evidenceRevision: number; viewedAt: Date; status: string;
} }> {
  if (!identifier.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: {
          schoolId, userId, isActive: true,
          role: "SCHOOL_SUPER_ADMIN",
          school: { isActive: true },
        },
        select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");

      // Call only the audited SQL allowlist. The DB never emits classmates,
      // answer keys, raw marks or another pupil's data.
      const rows = await tx.$queryRaw<Array<{ preview: OwnerGradePreview }>>`
        SELECT "read_private_owner_one_pupil_grade_preview"(
          ${schoolId},${parsed.data.compositionId},${parsed.data.studentId},
          ${owner.id},${userId}) AS "preview"`;
      const preview = rows[0]?.preview;
      if (!preview || preview.status !== "PRIVATE_OWNER_PREVIEW_NOT_RELEASED") {
        throw new AssessmentError("CONFLICT");
      }
      // Append a grade-free audit before returning the preview; rollback
      // the preview request if its audit record cannot be written.
      const audit = await tx.resultPrivateGradePreviewAudit.create({
        data: {
          id: randomUUID(),
          schoolId,
          compositionId: parsed.data.compositionId,
          studentId: parsed.data.studentId,
          actorMembershipId: owner.id,
          actorUserId: userId,
          reason: parsed.data.reason,
        },
        select: {
          id: true, evidenceRevision: true, viewedAt: true, status: true,
        },
      });
      return { preview, audit };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapError(error);
  }
}

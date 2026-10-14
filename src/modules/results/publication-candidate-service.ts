import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim() === value);

export interface InternalResultPublicationCandidate {
  evidenceId: string;
  revision: number;
  sessionId: string;
  termId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  studentCount: number;
  adoptionId: string;
  preparedAt: Date;
  reviewedAt: Date;
}

/**
 * PRIVATE, metadata-only School Super Admin preflight. No grades, pupil names,
 * marks, frozen sourceManifest, report card, export, mutation or publication.
 *
 * Authorization repeats in the SQL SELECT so revocation between the
 * membership pre-check and the read cannot disclose another school's data.
 * Every returned snapshot must be the latest, independently approved,
 * current-scope, current-policy and current-source version. This is NOT a
 * publication decision: the future server-side publication INSERT must
 * revalidate all of these invariants under a school row lock.
 */
export async function listInternalResultPublicationCandidates(
  schoolId: string,
): Promise<InternalResultPublicationCandidate[]> {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");

  return prisma.$queryRaw<InternalResultPublicationCandidate[]>(Prisma.sql`
    SELECT evidence."id" AS "evidenceId", evidence."revision",
      evidence."sessionId", evidence."termId", evidence."classId",
      classroom."name" AS "className", evidence."subjectId",
      subject."name" AS "subjectName", evidence."studentCount",
      evidence."adoptionId", evidence."preparedAt", review."reviewedAt"
    FROM "ResultSheetEvidence" evidence
    JOIN "School" school ON school."id"=evidence."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."isActive"=true AND owner."role"='SCHOOL_SUPER_ADMIN'
    JOIN "AcademicSession" session ON session."schoolId"=school."id"
      AND session."id"=evidence."sessionId" AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=session."id"
      AND term."id"=evidence."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" classroom ON classroom."schoolId"=school."id"
      AND classroom."id"=evidence."classId" AND classroom."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=classroom."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=evidence."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."id"=evidence."teacherMembershipId"
      AND teacher."userId"=evidence."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."id"=evidence."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=evidence."classId"
      AND assignment."subjectId"=evidence."subjectId"
      AND assignment."sessionId"=evidence."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "ResultSheetReview" review ON review."schoolId"=school."id"
      AND review."evidenceId"=evidence."id" AND review."action"='APPROVED'
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."id"=review."reviewerMembershipId"
      AND reviewer."userId"=review."reviewerUserId"
      AND reviewer."isActive"=true
      AND reviewer."userId"<>teacher."userId"
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
      AND scope."scopeId"=section."id"
    JOIN "ResultGradingAdoption" adoption
      ON adoption."schoolId"=school."id"
      AND adoption."id"=evidence."adoptionId"
      AND adoption."sessionId"=evidence."sessionId"
      AND adoption."termId"=evidence."termId"
      AND adoption."classId"=evidence."classId"
      AND adoption."subjectId"=evidence."subjectId"
    JOIN "AssessmentGradingPolicyRevision" policy
      ON policy."schoolId"=adoption."schoolId"
      AND policy."id"=adoption."policyId"
    WHERE evidence."schoolId"=${schoolId}
      AND NOT EXISTS (
        SELECT 1 FROM "ResultSheetEvidence" later
        WHERE later."schoolId"=evidence."schoolId"
          AND later."sessionId"=evidence."sessionId"
          AND later."termId"=evidence."termId"
          AND later."classId"=evidence."classId"
          AND later."subjectId"=evidence."subjectId"
          AND later."revision">evidence."revision"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "ResultGradingAdoption" newer
        WHERE newer."schoolId"=adoption."schoolId"
          AND newer."sessionId"=adoption."sessionId"
          AND newer."termId"=adoption."termId"
          AND newer."classId"=adoption."classId"
          AND newer."subjectId"=adoption."subjectId"
          AND newer."ordinal">adoption."ordinal"
      )
      -- Recompute under today's permissions and academic sources. No
      -- student-level values leave the database through this endpoint.
      AND evidence."sourceManifest" =
        "build_result_sheet_source_manifest"(
          evidence."schoolId",evidence."sessionId",evidence."termId",
          evidence."classId",evidence."subjectId",evidence."assignmentId")
      -- Defense in depth for databases that may have applied an older
      -- version of the result-sheet migration: reject any pupil missing
      -- a mandatory positive-weight adopted assessment category.
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(evidence."sourceManifest") AS pupil(value)
        WHERE (policy."quizWeight">0 AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(
              (pupil.value->'cbt')||(pupil.value->'manual')) AS item(value)
            WHERE item.value->>'kind'='QUIZ'
          )) OR (policy."testWeight">0 AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(
              (pupil.value->'cbt')||(pupil.value->'manual')) AS item(value)
            WHERE item.value->>'kind'='TEST'
          )) OR (policy."examWeight">0 AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(
              (pupil.value->'cbt')||(pupil.value->'manual')) AS item(value)
            WHERE item.value->>'kind'='EXAM'
          ))
      )
    ORDER BY review."reviewedAt" DESC, evidence."id" DESC
    LIMIT 100
  `);
}

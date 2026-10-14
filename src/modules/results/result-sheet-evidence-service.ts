import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
  exactAssessmentTeacher,
} from "@/src/modules/assessments/question-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v.trim() === v);
const prepareInput = z
  .object({
    assignmentId: id,
    termId: id,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
const reviewInput = z
  .object({
    action: z.enum(["APPROVED", "RETURNED"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
function checkId(value: string) {
  if (!id.safeParse(value).success) throw new AssessmentError("INVALID_INPUT");
}
function fail(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2034", "P2004", "P2010"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Teacher-authored immutable source checkpoint, NEVER client-derived marks.
 * Database trigger reconstructs every pupil/source mark from sealed, approved,
 * published scored CBT and independently reviewed written components. */
export async function prepareInternalResultSheetEvidence(
  schoolId: string,
  input: unknown,
) {
  checkId(schoolId);
  const parsed = prepareInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const teacher = await exactAssessmentTeacher(
          tx,
          schoolId,
          userId,
          parsed.data.assignmentId,
          parsed.data.termId,
        );
        const latest = await tx.resultGradingAdoption.findFirst({
          where: {
            schoolId,
            sessionId: teacher.term.sessionId,
            termId: teacher.term.id,
            classId: teacher.assignment.classId,
            subjectId: teacher.assignment.subjectId,
          },
          orderBy: { ordinal: "desc" },
          select: { id: true },
        });
        if (!latest) throw new AssessmentError("NOT_FOUND");
        const evidence = await tx.resultSheetEvidence.create({
          data: {
            id: randomUUID(),
            schoolId,
            sessionId: teacher.term.sessionId,
            termId: teacher.term.id,
            classId: teacher.assignment.classId,
            subjectId: teacher.assignment.subjectId,
            assignmentId: teacher.assignment.id,
            teacherMembershipId: teacher.teacherId,
            teacherUserId: userId,
            adoptionId: latest.id,
            reason: parsed.data.reason,
          },
          select: {
            id: true,
            sessionId: true,
            termId: true,
            classId: true,
            subjectId: true,
            revision: true,
            adoptionId: true,
            studentCount: true,
            preparedAt: true,
          },
        });
        return {
          ...evidence,
          status: "PREPARED_AWAITING_ACADEMIC_REVIEW" as const,
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    fail(error);
  }
}

/** Teacher sees only their own active assignment metadata, not another
 * teacher's class. This is not report or student result access. */
export async function listOwnResultSheetEvidence(schoolId: string) {
  checkId(schoolId);
  const userId = await assessmentUserId();
  const allowed = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "TEACHER",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!allowed) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      classId: string;
      subjectId: string;
      termId: string;
      revision: number;
      studentCount: number;
      adoptionId: string;
      reason: string;
      preparedAt: Date;
      reviewAction: string | null;
    }>
  >(Prisma.sql`
    SELECT evidence."id", evidence."classId", evidence."subjectId",
      evidence."termId", evidence."revision", evidence."studentCount",
      evidence."adoptionId", evidence."reason", evidence."preparedAt",
      review."action" AS "reviewAction"
    FROM "ResultSheetEvidence" evidence
    JOIN "School" school ON school."id"=evidence."schoolId"
      AND school."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."id"=evidence."teacherMembershipId"
      AND teacher."userId"=${userId}
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."id"=evidence."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=evidence."classId"
      AND assignment."subjectId"=evidence."subjectId"
      AND assignment."sessionId"=evidence."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" session ON session."schoolId"=school."id"
      AND session."id"=evidence."sessionId" AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=session."id"
      AND term."id"=evidence."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=school."id"
      AND room."id"=evidence."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=evidence."subjectId" AND subject."isActive"=true
    LEFT JOIN "ResultSheetReview" review
      ON review."schoolId"=evidence."schoolId"
      AND review."evidenceId"=evidence."id"
    WHERE evidence."schoolId"=${schoolId}
      AND evidence."teacherUserId"=${userId}
    ORDER BY evidence."preparedAt" DESC,evidence."id" DESC LIMIT 100
  `);
}

export interface ResultReviewQueueRow {
  id: string;
  className: string;
  subjectName: string;
  sectionName: string;
  termId: string;
  revision: number;
  studentCount: number;
  reason: string;
  preparedAt: Date;
  sourceManifest: unknown;
}
/** Private verified-section reviewer queue. Final SELECT binds each scope
 * to that school's actual class section and current source teacher. */
export async function listResultSheetAcademicReviewQueue(
  schoolId: string,
): Promise<ResultReviewQueueRow[]> {
  checkId(schoolId);
  const reviewerId = await assessmentUserId();
  const allowed = await prisma.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`
    SELECT true AS "ok" FROM "School" school
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."userId"=${reviewerId}
      AND reviewer."isActive"=true
    JOIN "ScopeGrant" grant ON grant."membershipId"=reviewer."id"
      AND grant."type"='SECTION' AND grant."verified"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=grant."scopeId" AND section."isActive"=true
    WHERE school."id"=${schoolId} AND school."isActive"=true
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    LIMIT 1
  `);
  if (!allowed.length) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<ResultReviewQueueRow[]>(Prisma.sql`
    SELECT evidence."id", room."name" AS "className",
      subject."name" AS "subjectName", section."name" AS "sectionName",
      evidence."termId", evidence."revision", evidence."studentCount",
      evidence."reason", evidence."preparedAt", evidence."sourceManifest"
    FROM "ResultSheetEvidence" evidence
    JOIN "School" school ON school."id"=evidence."schoolId"
      AND school."isActive"=true
    JOIN "SchoolClass" room ON room."schoolId"=school."id"
      AND room."id"=evidence."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=evidence."subjectId" AND subject."isActive"=true
    JOIN "AcademicSession" session ON session."schoolId"=school."id"
      AND session."id"=evidence."sessionId" AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=session."id"
      AND term."id"=evidence."termId" AND term."status"='ACTIVE'
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."id"=evidence."teacherMembershipId"
      AND teacher."userId"=evidence."teacherUserId"
      AND teacher."isActive"=true AND teacher."role"='TEACHER'
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."id"=evidence."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=evidence."classId"
      AND assignment."subjectId"=evidence."subjectId"
      AND assignment."sessionId"=evidence."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."userId"=${reviewerId} AND reviewer."isActive"=true
    JOIN "ScopeGrant" grant ON grant."membershipId"=reviewer."id"
      AND grant."type"='SECTION' AND grant."verified"=true
      AND grant."scopeId"=section."id"
    LEFT JOIN "ResultSheetReview" review
      ON review."schoolId"=school."id"
      AND review."evidenceId"=evidence."id"
    WHERE evidence."schoolId"=${schoolId} AND review."id" IS NULL
      AND reviewer."userId"<>teacher."userId"
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    ORDER BY evidence."preparedAt" DESC,evidence."id" DESC LIMIT 50
  `);
}

/** Separate independent reviewer decision. SQL verifies current data
 * freshness and latest adopted policy; a stale sheet cannot be approved. */
export async function decideResultSheetAcademicReview(
  schoolId: string,
  evidenceId: string,
  input: unknown,
) {
  checkId(schoolId);
  checkId(evidenceId);
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        // The eligibility SELECT must match actual class->section and verified
        // reviewer grant; the INSERT trigger repeats every check and also
        // compares the frozen source, latest adoption and revision under lock.
        const reviewers = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT reviewer."id" FROM "ResultSheetEvidence" evidence
        JOIN "School" school ON school."id"=evidence."schoolId"
          AND school."isActive"=true
        JOIN "SchoolClass" room ON room."schoolId"=school."id"
          AND room."id"=evidence."classId" AND room."isActive"=true
        JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
          AND section."id"=room."sectionId" AND section."isActive"=true
        JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
          AND reviewer."userId"=${userId}
          AND reviewer."isActive"=true
        JOIN "ScopeGrant" grant ON grant."membershipId"=reviewer."id"
          AND grant."type"='SECTION' AND grant."verified"=true
          AND grant."scopeId"=section."id"
        WHERE evidence."schoolId"=${schoolId}
          AND evidence."id"=${evidenceId}
          AND evidence."teacherUserId"<>${userId}
          AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
            OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
        LIMIT 1
      `);
        const reviewer = reviewers[0];
        if (!reviewer) throw new AssessmentError("NOT_FOUND");
        return tx.resultSheetReview.create({
          data: {
            id: randomUUID(),
            schoolId,
            evidenceId,
            reviewerMembershipId: reviewer.id,
            reviewerUserId: userId,
            action: parsed.data.action,
            reason: parsed.data.reason,
          },
          select: {
            id: true,
            evidenceId: true,
            action: true,
            reason: true,
            reviewedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    fail(error);
  }
}

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const idValid = (v: string) => Boolean(v && v.length <= 128 && v.trim() === v);
export interface ObjectiveScore {
  id: string;
  attemptId: string;
  maxPoints: number;
  earnedPoints: number;
  percentBps: number;
  questionCount: number;
  correctCount: number;
  passed: boolean;
  scoredAt: Date;
}

/** Internal-only automated marking request: never selects question keys in
 * application code. Exact active original teacher starts the transaction,
 * PostgreSQL trigger independently computes the actual weighted result.
 * No student scores or class sheets are published by this action. */
export async function scoreInternalSubmittedAttempt(
  schoolId: string,
  attemptId: string,
): Promise<ObjectiveScore> {
  if (!idValid(schoolId) || !idValid(attemptId)) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const userId = await assessmentUserId();
  for (let retry = 0; retry < 3; retry++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "School"
          WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
          await tx.$queryRaw`SELECT "id" FROM "AssessmentAttempt"
          WHERE "schoolId"=${schoolId} AND "id"=${attemptId} FOR UPDATE`;
          const record = await tx.assessmentAttempt.findFirst({
            where: {
              id: attemptId,
              schoolId,
              draft: {
                seal: { isNot: null },
                reviews: { some: { decision: "APPROVED" } },
                publicationEvents: { some: { action: "PUBLISHED" } },
                assignment: {
                  status: "ACTIVE",
                  membership: {
                    userId,
                    role: "TEACHER",
                    isActive: true,
                    school: { isActive: true },
                  },
                },
                teacherMembership: { userId, role: "TEACHER", isActive: true },
                session: { status: "ACTIVE" },
                term: { status: "ACTIVE" },
                schoolClass: { isActive: true, section: { isActive: true } },
                subject: { isActive: true },
              },
              submission: { isNot: null },
              AND: [
                {
                  draft: {
                    publicationEvents: { none: { action: "WITHDRAWN" } },
                  },
                },
              ],
            },
            select: {
              id: true,
              draft: { select: { teacherMembershipId: true } },
            },
          });
          if (!record) throw new AssessmentError("NOT_FOUND");
          const previous = await tx.assessmentAttemptScore.findFirst({
            where: { schoolId, attemptId },
            select: {
              id: true,
              attemptId: true,
              maxPoints: true,
              earnedPoints: true,
              percentBps: true,
              questionCount: true,
              correctCount: true,
              passed: true,
              scoredAt: true,
            },
          });
          if (previous) return previous;
          const rows = await tx.$queryRaw<ObjectiveScore[]>(Prisma.sql`
          INSERT INTO "AssessmentAttemptScore" (
            "id", "schoolId", "attemptId",
            "scorerMembershipId", "scorerUserId"
          ) VALUES (
            ${randomUUID()}, ${schoolId}, ${attemptId},
            ${record.draft.teacherMembershipId}, ${userId}
          )
          RETURNING "id","attemptId","maxPoints","earnedPoints",
            "percentBps","questionCount","correctCount","passed","scoredAt"
        `);
          if (rows.length !== 1) throw new AssessmentError("INTERNAL");
          return rows[0];
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof AssessmentError) throw error;
      if (
        retry < 2 &&
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "P2034" ||
          error.code === "P2002" ||
          (error.code === "P2010" &&
            "meta" in error &&
            error.meta &&
            typeof error.meta === "object" &&
            "code" in error.meta &&
            error.meta.code === "40001"))
      )
        continue;
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        throw new AssessmentError("CONFLICT");
      }
      throw new AssessmentError("INTERNAL");
    }
  }
  throw new AssessmentError("INTERNAL");
}

/** Current assignment TEACHER's own submitted-but-unscored attempt queue.
 * Metadata only, not question responses or answer keys. The exact final
 * SELECT repeats user/teacher/assignment/term/class/subject restrictions. */
export async function listOwnUnscoredCbtAttempts(schoolId: string) {
  if (!idValid(schoolId)) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const permitted = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >(Prisma.sql`
    SELECT true AS "allowed" FROM "School" school
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."userId"=${userId}
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."membershipId"=teacher."id"
      AND assignment."status"='ACTIVE' AND assignment."sessionId" IS NOT NULL
    JOIN "AcademicSession" period ON period."schoolId"=assignment."schoolId"
      AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
    WHERE school."id"=${schoolId} AND school."isActive"=true LIMIT 1
  `);
  if (!permitted.length) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      attemptId: string;
      draftId: string;
      title: string;
      className: string;
      subjectName: string;
      admissionNumber: string;
      attemptNumber: number;
      submittedAt: Date;
    }>
  >(Prisma.sql`
    SELECT attempt."id" AS "attemptId", draft."id" AS "draftId",
      draft."title", room."name" AS "className",
      subject."name" AS "subjectName", pupil."admissionNumber",
      attempt."attemptNumber", finished."submittedAt"
    FROM "AssessmentAttempt" attempt
    JOIN "School" school ON school."id"=attempt."schoolId"
      AND school."isActive"=true
    JOIN "AssessmentAttemptSubmission" finished
      ON finished."schoolId"=attempt."schoolId"
      AND finished."attemptId"=attempt."id"
      AND finished."submittedAt" <= attempt."deadlineAt"
    JOIN "AssessmentDraft" draft ON draft."schoolId"=attempt."schoolId"
      AND draft."id"=attempt."draftId"
      AND draft."classId"=attempt."classId"
      AND draft."sessionId"=attempt."sessionId"
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
      AND review."draftId"=draft."id" AND review."decision"='APPROVED'
    JOIN "AssessmentPublicationEvent" published
      ON published."schoolId"=draft."schoolId"
      AND published."draftId"=draft."id" AND published."action"='PUBLISHED'
    JOIN "Membership" teacher ON teacher."schoolId"=draft."schoolId"
      AND teacher."id"=draft."teacherMembershipId"
      AND teacher."userId"=${userId}
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=draft."sessionId"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=draft."schoolId"
      AND room."id"=draft."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "StudentRecord" pupil ON pupil."schoolId"=attempt."schoolId"
      AND pupil."id"=attempt."studentId"
    LEFT JOIN "AssessmentAttemptScore" scored
      ON scored."schoolId"=attempt."schoolId"
      AND scored."attemptId"=attempt."id"
    WHERE attempt."schoolId"=${schoolId} AND scored."id" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
        WHERE withdrawn."schoolId"=draft."schoolId"
          AND withdrawn."draftId"=draft."id"
          AND withdrawn."action"='WITHDRAWN'
      )
    ORDER BY finished."submittedAt" ASC, attempt."id" ASC LIMIT 100
  `);
}

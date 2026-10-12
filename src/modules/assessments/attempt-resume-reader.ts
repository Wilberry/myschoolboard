import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const validId = (value: string) =>
  Boolean(value && value.length <= 128 && value.trim() === value);

interface SafeQuestion {
  questionId: string;
  position: number;
  points: number;
  prompt: string;
  options: unknown;
  selectedIndex: number | null;
  revision: number | null;
}
interface AttemptMetadata {
  attemptId: string;
  draftId: string;
  title: string;
  kind: "QUIZ" | "TEST" | "EXAM";
  startedAt: Date;
  deadlineAt: Date;
  examEndsAt: Date;
  attemptNumber: number;
}

/** INTERNAL ONLY, no route/export to a client. The exact authorization joins
 * are in the FINAL content SELECT (not only in a preliminary permission
 * check), preventing wrong-pupil, school, class and revocation disclosure.
 * No AssessmentQuestionKey relation, correct answer or scoring join. */
export async function readInternalCbtAttempt(
  schoolId: string,
  attemptId: string,
): Promise<{ attempt: AttemptMetadata; questions: SafeQuestion[] }> {
  if (!validId(schoolId) || !validId(attemptId)) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const userId = await assessmentUserId();
  const result = await prisma.$queryRaw<Array<AttemptMetadata & SafeQuestion>>(Prisma.sql`
    SELECT attempt."id" AS "attemptId", draft."id" AS "draftId",
      draft."title", draft."kind", attempt."startedAt", attempt."deadlineAt",
      draft."endsAt" AS "examEndsAt", attempt."attemptNumber",
      item."questionId", item."position", item."points",
      question."prompt", question."options",
      saved."selectedIndex", saved."revision"
    FROM "AssessmentAttempt" attempt
    JOIN "School" school ON school."id"=attempt."schoolId"
      AND school."isActive"=true
    JOIN "AssessmentDraft" draft ON draft."schoolId"=attempt."schoolId"
      AND draft."id"=attempt."draftId"
      AND draft."classId"=attempt."classId"
      AND draft."sessionId"=attempt."sessionId"
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
      AND review."draftId"=draft."id" AND review."decision"='APPROVED'
    JOIN "AssessmentPublicationEvent" publication
      ON publication."schoolId"=draft."schoolId"
      AND publication."draftId"=draft."id"
      AND publication."action"='PUBLISHED'
    JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=draft."schoolId"
      AND room."id"=draft."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=draft."schoolId"
      AND teacher."id"=draft."teacherMembershipId"
      AND teacher."userId"=draft."teacherUserId"
      AND teacher."isActive"=true AND teacher."role"='TEACHER'
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "Membership" member ON member."schoolId"=attempt."schoolId"
      AND member."id"=attempt."studentMembershipId"
      AND member."userId"=attempt."studentUserId"
      AND member."userId"=${userId}
      AND member."role"='STUDENT' AND member."isActive"=true
    JOIN "StudentAccountLink" binding
      ON binding."schoolId"=attempt."schoolId"
      AND binding."id"=attempt."linkId"
      AND binding."studentId"=attempt."studentId"
      AND binding."studentMembershipId"=member."id"
    JOIN "StudentRecord" pupil ON pupil."schoolId"=attempt."schoolId"
      AND pupil."id"=attempt."studentId" AND pupil."status"='ENROLLED'
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId"=attempt."schoolId"
      AND enrollment."id"=attempt."enrollmentId"
      AND enrollment."studentId"=attempt."studentId"
      AND enrollment."classId"=attempt."classId"
      AND enrollment."sessionId"=attempt."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "AssessmentDraftQuestion" item
      ON item."schoolId"=draft."schoolId"
      AND item."draftId"=draft."id"
    JOIN "AssessmentQuestion" question ON question."schoolId"=item."schoolId"
      AND question."id"=item."questionId"
      AND question."classId"=draft."classId"
      AND question."subjectId"=draft."subjectId"
      AND question."sessionId"=draft."sessionId"
      AND question."termId"=draft."termId"
      AND question."assignmentId"=draft."assignmentId"
      AND question."teacherMembershipId"=draft."teacherMembershipId"
    LEFT JOIN LATERAL (
      SELECT response."selectedIndex", response."revision"
      FROM "AssessmentAttemptAnswerEvent" response
      WHERE response."schoolId"=attempt."schoolId"
        AND response."attemptId"=attempt."id"
        AND response."questionId"=item."questionId"
      ORDER BY response."revision" DESC
      LIMIT 1
    ) saved ON true
    WHERE attempt."schoolId"=${schoolId} AND attempt."id"=${attemptId}
      AND (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3)
        >= attempt."startedAt"
      AND (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3)
        < attempt."deadlineAt"
      AND NOT EXISTS (
        SELECT 1 FROM "StudentAccountLinkRevocation" revoked
        WHERE revoked."schoolId"=binding."schoolId"
          AND revoked."linkId"=binding."id"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
        WHERE withdrawn."schoolId"=draft."schoolId"
          AND withdrawn."draftId"=draft."id"
          AND withdrawn."action"='WITHDRAWN'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentAttemptSubmission" finalized
        WHERE finalized."schoolId"=attempt."schoolId"
          AND finalized."attemptId"=attempt."id"
      )
    ORDER BY item."position" ASC
    LIMIT 50
  `);
  if (!result.length) throw new AssessmentError("NOT_FOUND");
  const first = result[0];
  return {
    attempt: {
      attemptId: first.attemptId, draftId: first.draftId,
      title: first.title, kind: first.kind,
      startedAt: first.startedAt, deadlineAt: first.deadlineAt,
      examEndsAt: first.examEndsAt, attemptNumber: first.attemptNumber,
    },
    questions: result.map(row => ({
      questionId: row.questionId, position: row.position, points: row.points,
      prompt: row.prompt, options: row.options,
      selectedIndex: row.selectedIndex, revision: row.revision,
    })),
  };
}

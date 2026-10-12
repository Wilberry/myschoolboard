import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";
import {
  calculateWeightedPreview, type GradingWeights, type WeightedPreview,
} from "./grading-policy";

const valid = (s: string) => Boolean(s && s.length <= 128 && s.trim() === s);
export interface ClassRecordRow {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  draftId: string | null;
  title: string | null;
  kind: "QUIZ" | "TEST" | "EXAM" | null;
  assessmentMaxPoints: number | null;
  attemptNumber: number | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  percentBps: number | null;
  passed: boolean | null;
  scoredAt: Date | null;
  gradingVersion: number | null;
  quizWeight: number | null;
  testWeight: number | null;
  examWeight: number | null;
}
export interface ClassRecordStudent {
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  assessments: Array<{
    draftId: string;
    title: string;
    kind: "QUIZ" | "TEST" | "EXAM";
    possiblePoints: number;
    earnedPoints: number | null;
    percentBps: number | null;
    passed: boolean | null;
    attemptNumber: number | null;
  }>;
  assessedPoints: number;
  possiblePoints: number;
  pendingAssessments: number;
  percentBps: number | null;
  weightedPreview: WeightedPreview | null;
}

/** Private, provisional teacher subject record, not an official grade or
 * result release. One student row per active exact class/session enrollment,
 * and one assessment entry per approved + currently published school draft.
 * Prefer the highest SQL-computed score per assessment across submitted
 * attempts; never read raw student options or correctness keys.
 * Final SELECT rechecks exact current TEACHER assignment, not just role. */
export async function readInternalTeacherClassRecord(
  schoolId: string, sessionId: string, termId: string,
  classId: string, subjectId: string,
): Promise<{ classId: string; subjectId: string; sessionId: string;
  termId: string; students: ClassRecordStudent[];
  gradingPolicy: (GradingWeights & { version: number; status: "DRAFT_PREVIEW_ONLY" }) | null }> {
  if (![schoolId, sessionId, termId, classId, subjectId].every(valid)) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const userId = await assessmentUserId();
  const allowed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT teacher."id" FROM "School" school
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."userId"=${userId} AND teacher."role"='TEACHER'
      AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=${classId} AND assignment."subjectId"=${subjectId}
      AND assignment."sessionId"=${sessionId}
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=school."id"
      AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=period."id" AND term."id"=${termId}
      AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=school."id"
      AND room."id"=assignment."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE school."id"=${schoolId} AND school."isActive"=true LIMIT 1
  `);
  if (!allowed.length) throw new AssessmentError("NOT_FOUND");
  const rows = await prisma.$queryRaw<ClassRecordRow[]>(Prisma.sql`
    SELECT pupil."id" AS "studentId", pupil."admissionNumber",
      pupil."givenName", pupil."familyName", draft."id" AS "draftId",
      draft."title", draft."kind",
      tally."possiblePoints" AS "assessmentMaxPoints",
      best."attemptNumber", best."earnedPoints", best."maxPoints",
      best."percentBps", best."passed", best."scoredAt",
      grading."version" AS "gradingVersion",
      grading."quizWeight", grading."testWeight", grading."examWeight"
    FROM "School" school
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."userId"=${userId}
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=${classId}
      AND assignment."subjectId"=${subjectId}
      AND assignment."sessionId"=${sessionId}
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=school."id"
      AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."sessionId"=period."id" AND term."id"=${termId}
      AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=school."id"
      AND room."id"=assignment."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId"=school."id"
      AND enrollment."classId"=room."id"
      AND enrollment."sessionId"=period."id"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id"
      AND pupil."id"=enrollment."studentId" AND pupil."status"='ENROLLED'
    LEFT JOIN LATERAL (
      SELECT assessment."id", assessment."title", assessment."kind"
      FROM "AssessmentDraft" assessment
      JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=assessment."schoolId"
        AND seal."draftId"=assessment."id"
      JOIN "AssessmentReviewEvent" review
        ON review."schoolId"=assessment."schoolId"
        AND review."draftId"=assessment."id" AND review."decision"='APPROVED'
      JOIN "AssessmentPublicationEvent" published
        ON published."schoolId"=assessment."schoolId"
        AND published."draftId"=assessment."id"
        AND published."action"='PUBLISHED'
      JOIN "Membership" author ON author."schoolId"=assessment."schoolId"
        AND author."id"=assessment."teacherMembershipId"
        AND author."userId"=assessment."teacherUserId"
        AND author."role"='TEACHER' AND author."isActive"=true
      JOIN "TeacherClassSubjectAssignment" ownership
        ON ownership."schoolId"=assessment."schoolId"
        AND ownership."id"=assessment."assignmentId"
        AND ownership."membershipId"=author."id"
        AND ownership."classId"=assessment."classId"
        AND ownership."subjectId"=assessment."subjectId"
        AND ownership."sessionId"=assessment."sessionId"
        AND ownership."status"='ACTIVE'
      WHERE assessment."schoolId"=school."id"
        AND assessment."sessionId"=period."id"
        AND assessment."termId"=term."id"
        AND assessment."classId"=room."id"
        AND assessment."subjectId"=subject."id"
        AND NOT EXISTS (
          SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
          WHERE withdrawn."schoolId"=assessment."schoolId"
            AND withdrawn."draftId"=assessment."id"
            AND withdrawn."action"='WITHDRAWN'
        )
      ORDER BY assessment."createdAt" ASC, assessment."id" ASC
      LIMIT 31
    ) draft ON true
    LEFT JOIN LATERAL (
      SELECT SUM(item."points")::int AS "possiblePoints"
      FROM "AssessmentDraftQuestion" item
      WHERE item."schoolId"=school."id" AND item."draftId"=draft."id"
    ) tally ON draft."id" IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT attempt."attemptNumber", score."earnedPoints", score."maxPoints",
        score."percentBps", score."passed", score."scoredAt"
      FROM "AssessmentAttempt" attempt
      JOIN "AssessmentAttemptSubmission" submitted
        ON submitted."schoolId"=attempt."schoolId"
        AND submitted."attemptId"=attempt."id"
      JOIN "AssessmentAttemptScore" score
        ON score."schoolId"=attempt."schoolId"
        AND score."attemptId"=attempt."id"
      WHERE attempt."schoolId"=school."id"
        AND attempt."draftId"=draft."id"
        AND attempt."studentId"=pupil."id"
        AND attempt."enrollmentId"=enrollment."id"
        AND attempt."classId"=room."id"
        AND attempt."sessionId"=period."id"
      ORDER BY score."percentBps" DESC, score."earnedPoints" DESC,
        attempt."attemptNumber" ASC
      LIMIT 1
    ) best ON draft."id" IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT policy."version", policy."quizWeight",
        policy."testWeight", policy."examWeight"
      FROM "AssessmentGradingPolicyRevision" policy
      WHERE policy."schoolId"=school."id"
        AND policy."sessionId"=period."id"
        AND policy."termId"=term."id"
        AND policy."classId"=room."id"
        AND policy."subjectId"=subject."id"
      ORDER BY policy."version" DESC LIMIT 1
    ) grading ON true
    WHERE school."id"=${schoolId} AND school."isActive"=true
    ORDER BY pupil."admissionNumber", pupil."id", draft."id"
    LIMIT 15501
  `);
  if (rows.length > 15500) throw new AssessmentError("CONFLICT");
  const grouped = new Map<string, ClassRecordStudent>();
  for (const row of rows) {
    let student = grouped.get(row.studentId);
    if (!student) {
      student = {
        studentId: row.studentId, admissionNumber: row.admissionNumber,
        givenName: row.givenName, familyName: row.familyName,
        assessments: [], assessedPoints: 0, possiblePoints: 0,
        pendingAssessments: 0, percentBps: null,
      weightedPreview: null,
      };
      grouped.set(row.studentId, student);
    }
    if (row.draftId && row.title && row.kind) {
      if (student.assessments.some(a => a.draftId === row.draftId)) {
        throw new AssessmentError("CONFLICT");
      }
      if (student.assessments.length >= 30) throw new AssessmentError("CONFLICT");
      const possiblePoints = row.assessmentMaxPoints ?? 0;
      if (possiblePoints < 1) throw new AssessmentError("CONFLICT");
      student.assessments.push({
        draftId: row.draftId, title: row.title, kind: row.kind,
        possiblePoints, earnedPoints: row.earnedPoints,
        percentBps: row.percentBps, passed: row.passed,
        attemptNumber: row.attemptNumber,
      });
      if (row.earnedPoints === null) student.pendingAssessments++;
      else {
        student.assessedPoints += row.earnedPoints;
        student.possiblePoints += possiblePoints;
      }
    }
    if (grouped.size > 500) throw new AssessmentError("CONFLICT");
  }
  const first = rows[0];
  const gradingPolicy: (GradingWeights & {
    version: number; status: "DRAFT_PREVIEW_ONLY";
  }) | null = first?.gradingVersion !== null &&
    first?.gradingVersion !== undefined &&
    first.quizWeight !== null && first.testWeight !== null &&
    first.examWeight !== null
    ? {
      version: first.gradingVersion, quizWeight: first.quizWeight,
      testWeight: first.testWeight, examWeight: first.examWeight,
      status: "DRAFT_PREVIEW_ONLY",
    } : null;
  for (const student of grouped.values()) {
    if (gradingPolicy) {
      student.weightedPreview = calculateWeightedPreview(gradingPolicy,
        student.assessments.map(a => ({
          kind: a.kind, percentBps: a.percentBps,
        })));
    }
    if (student.possiblePoints > 0) {
      student.percentBps = Math.round(
        student.assessedPoints * 10000 / student.possiblePoints,
      );
    }
  }
  return { sessionId, termId, classId, subjectId,
    gradingPolicy, students: Array.from(grouped.values()) };
}

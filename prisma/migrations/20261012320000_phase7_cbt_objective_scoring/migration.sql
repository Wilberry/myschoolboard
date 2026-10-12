-- Internal-only automated objective marking. Keys remain in PostgreSQL
-- and are never selected by student question, staff queue or API projections.
-- One immutable score per submitted attempt; no official result publication.
CREATE TABLE "AssessmentAttemptScore" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "scorerMembershipId" TEXT NOT NULL,
  "scorerUserId" TEXT NOT NULL,
  "maxPoints" INTEGER NOT NULL DEFAULT 0,
  "earnedPoints" INTEGER NOT NULL DEFAULT 0,
  "percentBps" INTEGER NOT NULL DEFAULT 0,
  "questionCount" INTEGER NOT NULL DEFAULT 0,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentAttemptScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentAttemptScore_validity_check" CHECK (
    "maxPoints" BETWEEN 1 AND 1000 AND
    "earnedPoints" BETWEEN 0 AND "maxPoints" AND
    "percentBps" BETWEEN 0 AND 10000 AND
    "questionCount" BETWEEN 1 AND 50 AND
    "correctCount" BETWEEN 0 AND "questionCount"
  )
);
CREATE UNIQUE INDEX "AssessmentAttemptScore_schoolId_attemptId_key"
  ON "AssessmentAttemptScore"("schoolId","attemptId");
CREATE INDEX "AssessmentAttemptScore_schoolId_scoredAt_idx"
  ON "AssessmentAttemptScore"("schoolId","scoredAt");
ALTER TABLE "AssessmentAttemptScore"
 ADD CONSTRAINT "AssessmentAttemptScore_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptScore"
 ADD CONSTRAINT "AssessmentAttemptScore_attempt_fkey"
 FOREIGN KEY ("schoolId","attemptId") REFERENCES "AssessmentAttempt"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptScore"
 ADD CONSTRAINT "AssessmentAttemptScore_scorer_fkey"
 FOREIGN KEY ("schoolId","scorerMembershipId") REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_cbt_objective_score"() RETURNS trigger AS $$
DECLARE
  max_score INTEGER;
  earned_score INTEGER;
  questions INTEGER;
  correct_answers INTEGER;
  expected_questions INTEGER;
  threshold INTEGER;
BEGIN
  -- Locks serialize with school publication withdrawal and all attempt
  -- answer/final-submission mutations. A return of an existing score is
  -- an application idempotency behavior, not another score insertion.
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive school cannot mark CBT' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM "AssessmentAttempt" attempt
    WHERE attempt."schoolId"=NEW."schoolId" AND attempt."id"=NEW."attemptId"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown exact-school CBT attempt' USING ERRCODE='23503';
  END IF;
  SELECT draft."passPercent" INTO threshold
    FROM "AssessmentAttempt" attempt
    JOIN "AssessmentAttemptSubmission" final
      ON final."schoolId"=attempt."schoolId"
      AND final."attemptId"=attempt."id"
      AND final."submittedAt" <= attempt."deadlineAt"
    JOIN "AssessmentDraft" draft
      ON draft."schoolId"=attempt."schoolId" AND draft."id"=attempt."draftId"
      AND draft."classId"=attempt."classId" AND draft."sessionId"=attempt."sessionId"
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
      AND review."draftId"=draft."id" AND review."decision"='APPROVED'
    JOIN "AssessmentPublicationEvent" publication
      ON publication."schoolId"=draft."schoolId"
      AND publication."draftId"=draft."id" AND publication."action"='PUBLISHED'
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
    JOIN "Membership" scorer ON scorer."schoolId"=draft."schoolId"
      AND scorer."id"=NEW."scorerMembershipId"
      AND scorer."userId"=NEW."scorerUserId"
      AND scorer."id"=draft."teacherMembershipId"
      AND scorer."role"='TEACHER' AND scorer."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=scorer."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    WHERE attempt."schoolId"=NEW."schoolId"
      AND attempt."id"=NEW."attemptId"
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
        WHERE withdrawn."schoolId"=draft."schoolId"
          AND withdrawn."draftId"=draft."id"
          AND withdrawn."action"='WITHDRAWN'
      );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact teacher may only mark submitted active published exam'
      USING ERRCODE='23503';
  END IF;

  SELECT COUNT(*)::int INTO expected_questions
    FROM "AssessmentAttempt" attempt
    JOIN "AssessmentDraftQuestion" item
      ON item."schoolId"=attempt."schoolId"
      AND item."draftId"=attempt."draftId"
    WHERE attempt."schoolId"=NEW."schoolId" AND attempt."id"=NEW."attemptId";
  SELECT COUNT(*)::int, COALESCE(SUM(item."points"),0)::int,
    COALESCE(SUM(CASE WHEN saved."selectedIndex" = key."correctIndex"
      THEN item."points" ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN saved."selectedIndex" = key."correctIndex"
      THEN 1 ELSE 0 END),0)::int
    INTO questions, max_score, earned_score, correct_answers
    FROM "AssessmentAttempt" attempt
    JOIN "AssessmentDraftQuestion" item
      ON item."schoolId"=attempt."schoolId"
      AND item."draftId"=attempt."draftId"
    JOIN "AssessmentQuestionKey" key ON key."schoolId"=item."schoolId"
      AND key."questionId"=item."questionId"
    LEFT JOIN LATERAL (
      SELECT answer."selectedIndex"
      FROM "AssessmentAttemptAnswerEvent" answer
      WHERE answer."schoolId"=attempt."schoolId"
        AND answer."attemptId"=attempt."id"
        AND answer."questionId"=item."questionId"
      ORDER BY answer."revision" DESC LIMIT 1
    ) saved ON true
    WHERE attempt."schoolId"=NEW."schoolId" AND attempt."id"=NEW."attemptId";
  IF questions <> expected_questions OR questions NOT BETWEEN 1 AND 50 OR
     max_score NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Assessment marking requires complete sealed question keys'
      USING ERRCODE='23514';
  END IF;
  NEW."maxPoints" := max_score;
  NEW."earnedPoints" := earned_score;
  NEW."percentBps" := ROUND(earned_score * 10000.0 / max_score)::int;
  NEW."questionCount" := questions;
  NEW."correctCount" := correct_answers;
  NEW."passed" := (earned_score * 100 >= threshold * max_score);
  NEW."scoredAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentAttemptScore_validate"
 BEFORE INSERT ON "AssessmentAttemptScore"
 FOR EACH ROW EXECUTE FUNCTION "validate_cbt_objective_score"();
CREATE TRIGGER "AssessmentAttemptScore_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentAttemptScore"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentAttemptScore_no_truncate"
 BEFORE TRUNCATE ON "AssessmentAttemptScore"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

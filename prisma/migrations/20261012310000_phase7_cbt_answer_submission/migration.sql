-- Phase 7 ASM-REQ-001: append-only answer autosaves and one terminal submission.
-- Internal-only, never exposes CBT delivery, answers to staff, keys or grades.
-- All writes share the school FOR UPDATE lock with attempt admission and
-- school-admin publication withdrawal / attested student-link revocation.
CREATE TABLE "AssessmentAttemptAnswerEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "requestKey" VARCHAR(128) NOT NULL,
  "selectedIndex" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentAttemptAnswerEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentAttemptAnswerEvent_selection_check"
    CHECK ("selectedIndex" BETWEEN 0 AND 5 AND "revision" >= 1),
  CONSTRAINT "AssessmentAttemptAnswerEvent_request_check"
    CHECK (char_length(btrim("requestKey")) BETWEEN 16 AND 128)
);
CREATE UNIQUE INDEX "AssessmentAttemptAnswerEvent_schoolId_attemptId_requestKey_key"
  ON "AssessmentAttemptAnswerEvent"("schoolId","attemptId","requestKey");
CREATE UNIQUE INDEX "AssessmentAttemptAnswerEvent_schoolId_attemptId_questionId_revision_key"
  ON "AssessmentAttemptAnswerEvent"("schoolId","attemptId","questionId","revision");
CREATE INDEX "AssessmentAttemptAnswerEvent_schoolId_attemptId_createdAt_idx"
  ON "AssessmentAttemptAnswerEvent"("schoolId","attemptId","createdAt");
ALTER TABLE "AssessmentAttemptAnswerEvent" ADD CONSTRAINT
  "AssessmentAttemptAnswerEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptAnswerEvent" ADD CONSTRAINT
  "AssessmentAttemptAnswerEvent_attempt_fkey"
  FOREIGN KEY ("schoolId","attemptId") REFERENCES "AssessmentAttempt"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptAnswerEvent" ADD CONSTRAINT
  "AssessmentAttemptAnswerEvent_question_fkey"
  FOREIGN KEY ("schoolId","questionId") REFERENCES "AssessmentQuestion"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptAnswerEvent" ADD CONSTRAINT
  "AssessmentAttemptAnswerEvent_actor_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentAttemptSubmission" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "requestKey" VARCHAR(128) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentAttemptSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentAttemptSubmission_request_check"
    CHECK (char_length(btrim("requestKey")) BETWEEN 16 AND 128)
);
CREATE UNIQUE INDEX "AssessmentAttemptSubmission_schoolId_attemptId_key"
  ON "AssessmentAttemptSubmission"("schoolId","attemptId");
ALTER TABLE "AssessmentAttemptSubmission" ADD CONSTRAINT
  "AssessmentAttemptSubmission_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptSubmission" ADD CONSTRAINT
  "AssessmentAttemptSubmission_attempt_fkey"
  FOREIGN KEY ("schoolId","attemptId") REFERENCES "AssessmentAttempt"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptSubmission" ADD CONSTRAINT
  "AssessmentAttemptSubmission_actor_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- A single authoritative validation shared by both insert triggers.
-- This is a consistency check against stored identity and scope; the internal
-- service separately binds it to the actual authenticated Better Auth user.
CREATE FUNCTION "assert_cbt_attempt_writable"(
  p_school TEXT, p_attempt TEXT, p_actor_member TEXT, p_actor_user TEXT
) RETURNS TIMESTAMP(3) AS $$
DECLARE
  server_now TIMESTAMP(3);
  actual_deadline TIMESTAMP(3);
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id"=p_school AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CBT school inactive or unavailable' USING ERRCODE='23503';
  END IF;
  SELECT attempt."deadlineAt" INTO actual_deadline
    FROM "AssessmentAttempt" attempt
    JOIN "AssessmentDraft" draft
      ON draft."schoolId"=attempt."schoolId" AND draft."id"=attempt."draftId"
      AND draft."classId"=attempt."classId"
      AND draft."sessionId"=attempt."sessionId"
    JOIN "AssessmentDraftSeal" seal
      ON seal."schoolId"=draft."schoolId" AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review
      ON review."schoolId"=draft."schoolId" AND review."draftId"=draft."id"
      AND review."decision"='APPROVED'
    JOIN "AssessmentPublicationEvent" published
      ON published."schoolId"=draft."schoolId"
      AND published."draftId"=draft."id" AND published."action"='PUBLISHED'
    JOIN "AcademicSession" period
      ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term
      ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room
      ON room."schoolId"=draft."schoolId"
      AND room."id"=draft."classId" AND room."isActive"=true
    JOIN "SchoolSection" section
      ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject
      ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher
      ON teacher."schoolId"=draft."schoolId"
      AND teacher."id"=draft."teacherMembershipId"
      AND teacher."userId"=draft."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "Membership" member
      ON member."schoolId"=attempt."schoolId"
      AND member."id"=attempt."studentMembershipId"
      AND member."id"=p_actor_member
      AND member."userId"=attempt."studentUserId"
      AND member."userId"=p_actor_user
      AND member."role"='STUDENT' AND member."isActive"=true
    JOIN "StudentAccountLink" binding
      ON binding."schoolId"=attempt."schoolId"
      AND binding."id"=attempt."linkId"
      AND binding."studentId"=attempt."studentId"
      AND binding."studentMembershipId"=member."id"
    JOIN "StudentRecord" pupil
      ON pupil."schoolId"=attempt."schoolId"
      AND pupil."id"=attempt."studentId" AND pupil."status"='ENROLLED'
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId"=attempt."schoolId"
      AND enrollment."id"=attempt."enrollmentId"
      AND enrollment."studentId"=attempt."studentId"
      AND enrollment."classId"=attempt."classId"
      AND enrollment."sessionId"=attempt."sessionId"
      AND enrollment."status"='ACTIVE'
    WHERE attempt."schoolId"=p_school AND attempt."id"=p_attempt
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
        WHERE withdrawn."schoolId"=draft."schoolId"
          AND withdrawn."draftId"=draft."id"
          AND withdrawn."action"='WITHDRAWN'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "StudentAccountLinkRevocation" revoked
        WHERE revoked."schoolId"=binding."schoolId"
          AND revoked."linkId"=binding."id"
      )
    FOR UPDATE OF attempt;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CBT attempt is not currently authorized'
      USING ERRCODE='23503';
  END IF;
  server_now := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  IF server_now < (SELECT a."startedAt" FROM "AssessmentAttempt" a
      WHERE a."schoolId"=p_school AND a."id"=p_attempt)
    OR server_now >= actual_deadline THEN
    RAISE EXCEPTION 'CBT attempt deadline reached' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AssessmentAttemptSubmission" finish
    WHERE finish."schoolId"=p_school AND finish."attemptId"=p_attempt
  ) THEN
    RAISE EXCEPTION 'CBT attempt already submitted'
      USING ERRCODE='23505';
  END IF;
  RETURN server_now;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_assessment_answer_event"() RETURNS trigger AS $$
DECLARE
  server_now TIMESTAMP(3);
  option_count INTEGER;
BEGIN
  server_now := "assert_cbt_attempt_writable"(
    NEW."schoolId", NEW."attemptId", NEW."actorMembershipId", NEW."actorUserId"
  );
  SELECT jsonb_array_length(question."options") INTO option_count
    FROM "AssessmentAttempt" attempt
    JOIN "AssessmentDraftQuestion" item
      ON item."schoolId"=attempt."schoolId"
      AND item."draftId"=attempt."draftId"
    JOIN "AssessmentQuestion" question
      ON question."schoolId"=item."schoolId"
      AND question."id"=item."questionId"
    WHERE attempt."schoolId"=NEW."schoolId"
      AND attempt."id"=NEW."attemptId"
      AND item."questionId"=NEW."questionId";
  IF option_count IS NULL OR NEW."selectedIndex" < 0
      OR NEW."selectedIndex" >= option_count THEN
    RAISE EXCEPTION 'Answer not in sealed assessment question choices'
      USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "AssessmentAttemptAnswerEvent" prior
    WHERE prior."schoolId"=NEW."schoolId"
      AND prior."attemptId"=NEW."attemptId"
      AND prior."requestKey"=NEW."requestKey") THEN
    RAISE EXCEPTION 'Duplicate autosave key: use exact idempotent replay'
      USING ERRCODE='23505';
  END IF;
  SELECT COALESCE(MAX(prior."revision"),0)::int + 1 INTO NEW."revision"
    FROM "AssessmentAttemptAnswerEvent" prior
    WHERE prior."schoolId"=NEW."schoolId"
      AND prior."attemptId"=NEW."attemptId"
      AND prior."questionId"=NEW."questionId";
  NEW."createdAt" := server_now;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_assessment_attempt_submission"() RETURNS trigger AS $$
BEGIN
  NEW."submittedAt" := "assert_cbt_attempt_writable"(
    NEW."schoolId", NEW."attemptId", NEW."actorMembershipId", NEW."actorUserId"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentAttemptAnswerEvent_validate"
  BEFORE INSERT ON "AssessmentAttemptAnswerEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_assessment_answer_event"();
CREATE TRIGGER "AssessmentAttemptSubmission_validate"
  BEFORE INSERT ON "AssessmentAttemptSubmission"
  FOR EACH ROW EXECUTE FUNCTION "validate_assessment_attempt_submission"();

CREATE TRIGGER "AssessmentAttemptAnswerEvent_immutable"
  BEFORE UPDATE OR DELETE ON "AssessmentAttemptAnswerEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentAttemptSubmission_immutable"
  BEFORE UPDATE OR DELETE ON "AssessmentAttemptSubmission"
  FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentAttemptAnswerEvent_no_truncate"
  BEFORE TRUNCATE ON "AssessmentAttemptAnswerEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentAttemptSubmission_no_truncate"
  BEFORE TRUNCATE ON "AssessmentAttemptSubmission"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

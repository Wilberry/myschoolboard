-- ASM-REQ-001: immutable admission reservations for an exact enrolled pupil.
-- No student HTTP route, questions, answer events, marking, score or delivery.
-- Single per-school row lock serializes admission with current school-locked
-- identity revocation and publication withdrawal mutations.
CREATE TABLE "AssessmentAttempt" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadlineAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentAttempt_number_check" CHECK ("attemptNumber" BETWEEN 1 AND 3),
  CONSTRAINT "AssessmentAttempt_deadline_check" CHECK ("deadlineAt" > "startedAt")
);
CREATE UNIQUE INDEX "AssessmentAttempt_schoolId_id_key"
  ON "AssessmentAttempt"("schoolId","id");
CREATE UNIQUE INDEX "AssessmentAttempt_schoolId_draftId_studentId_attemptNumber_key"
  ON "AssessmentAttempt"("schoolId","draftId","studentId","attemptNumber");
CREATE INDEX "AssessmentAttempt_schoolId_studentId_startedAt_idx"
  ON "AssessmentAttempt"("schoolId","studentId","startedAt");
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_draft_fkey"
  FOREIGN KEY ("schoolId","draftId") REFERENCES "AssessmentDraft"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_student_fkey"
  FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_enrollment_fkey"
  FOREIGN KEY ("schoolId","enrollmentId","studentId","classId","sessionId")
  REFERENCES "StudentEnrollment"("schoolId","id","studentId","classId","sessionId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_membership_fkey"
  FOREIGN KEY ("schoolId","studentMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_link_fkey"
  FOREIGN KEY ("schoolId","linkId") REFERENCES "StudentAccountLink"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_attempt_admission"()
RETURNS trigger AS $$
DECLARE
  clock_now TIMESTAMP(3);
  draft_start TIMESTAMP(3);
  draft_end TIMESTAMP(3);
  draft_minutes INTEGER;
  allowed_attempts INTEGER;
  prior_attempts INTEGER;
  next_number INTEGER;
BEGIN
  -- This is a shared serialization anchor with school-admin revocation and
  -- exam publication/withdrawal. Never trust client date, sequence or expiry.
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active same-school admission required'
      USING ERRCODE='23503';
  END IF;

  SELECT draft."startsAt", draft."endsAt", draft."durationMinutes",
         draft."maxAttempts"
    INTO draft_start, draft_end, draft_minutes, allowed_attempts
    FROM "AssessmentDraft" draft
    JOIN "AssessmentDraftSeal" seal
      ON seal."schoolId"=draft."schoolId" AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review
      ON review."schoolId"=draft."schoolId"
      AND review."draftId"=draft."id" AND review."decision"='APPROVED'
    JOIN "AssessmentPublicationEvent" publish
      ON publish."schoolId"=draft."schoolId" AND publish."draftId"=draft."id"
      AND publish."action"='PUBLISHED'
    JOIN "AcademicSession" period
      ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term
      ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" classroom
      ON classroom."schoolId"=draft."schoolId"
      AND classroom."id"=draft."classId" AND classroom."isActive"=true
    JOIN "SchoolSection" section
      ON section."schoolId"=draft."schoolId"
      AND section."id"=classroom."sectionId" AND section."isActive"=true
    JOIN "Subject" subject
      ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher
      ON teacher."schoolId"=draft."schoolId"
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
    JOIN "Membership" member
      ON member."schoolId"=draft."schoolId"
      AND member."id"=NEW."studentMembershipId"
      AND member."userId"=NEW."studentUserId"
      AND member."role"='STUDENT' AND member."isActive"=true
    JOIN "StudentAccountLink" binding
      ON binding."schoolId"=draft."schoolId"
      AND binding."id"=NEW."linkId"
      AND binding."studentMembershipId"=member."id"
      AND binding."studentId"=NEW."studentId"
    JOIN "StudentRecord" pupil
      ON pupil."schoolId"=draft."schoolId"
      AND pupil."id"=binding."studentId" AND pupil."status"='ENROLLED'
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId"=draft."schoolId"
      AND enrollment."id"=NEW."enrollmentId"
      AND enrollment."studentId"=pupil."id"
      AND enrollment."classId"=draft."classId"
      AND enrollment."sessionId"=draft."sessionId"
      AND enrollment."status"='ACTIVE'
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
      AND NEW."classId"=draft."classId" AND NEW."sessionId"=draft."sessionId"
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentPublicationEvent" revoked
        WHERE revoked."schoolId"=draft."schoolId"
          AND revoked."draftId"=draft."id" AND revoked."action"='WITHDRAWN'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "StudentAccountLinkRevocation" revocation
        WHERE revocation."schoolId"=binding."schoolId"
          AND revocation."linkId"=binding."id"
      )
    FOR SHARE OF draft, period, term, classroom, section, subject,
      teacher, assignment, member, binding, pupil, enrollment;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No authorized published exam for exact verified enrollment'
      USING ERRCODE='23503';
  END IF;

  -- AssessmentDraft timestamps are UTC-by-convention timestamp(3);
  -- compute against the server UTC clock regardless of DB session timezone.
  clock_now := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  IF clock_now < draft_start OR clock_now >= draft_end THEN
    RAISE EXCEPTION 'Exam window is not open'
      USING ERRCODE='23514';
  END IF;

  SELECT COUNT(*)::int, COALESCE(MAX(attempt."attemptNumber"),0)::int + 1
    INTO prior_attempts, next_number
    FROM "AssessmentAttempt" attempt
    WHERE attempt."schoolId"=NEW."schoolId"
      AND attempt."draftId"=NEW."draftId" AND attempt."studentId"=NEW."studentId";
  IF prior_attempts >= allowed_attempts
     OR next_number > allowed_attempts THEN
    RAISE EXCEPTION 'Maximum CBT attempts reached'
      USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AssessmentAttempt" active
    WHERE active."schoolId"=NEW."schoolId"
      AND active."draftId"=NEW."draftId" AND active."studentId"=NEW."studentId"
      AND active."deadlineAt" > clock_now
  ) THEN
    RAISE EXCEPTION 'Existing CBT reservation has not expired'
      USING ERRCODE='23505';
  END IF;

  NEW."attemptNumber" := next_number;
  NEW."startedAt" := clock_now;
  NEW."deadlineAt" := LEAST(
    clock_now + make_interval(mins => draft_minutes),
    draft_end
  );
  IF NEW."deadlineAt" <= NEW."startedAt" THEN
    RAISE EXCEPTION 'Invalid CBT remaining time' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentAttempt_validate"
 BEFORE INSERT ON "AssessmentAttempt"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_attempt_admission"();
CREATE TRIGGER "AssessmentAttempt_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentAttempt"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentAttempt_no_truncate"
 BEFORE TRUNCATE ON "AssessmentAttempt"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

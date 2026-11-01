-- Phase 7 ASM-REQ-001, additive only, review-only migration.
-- No exam publication, student attempt, answer key read, score or live data.
CREATE TABLE "AssessmentQuestion" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL, "teacherMembershipId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL, "prompt" VARCHAR(2000) NOT NULL,
  "options" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentQuestion_content_check" CHECK (
    char_length(btrim("prompt")) BETWEEN 5 AND 2000
    AND jsonb_typeof("options") = 'array'
    AND jsonb_array_length("options") BETWEEN 2 AND 6
  )
);
CREATE UNIQUE INDEX "AssessmentQuestion_schoolId_id_key"
  ON "AssessmentQuestion"("schoolId","id");
CREATE INDEX "AssessmentQuestion_schoolId_classId_subjectId_termId_idx"
  ON "AssessmentQuestion"("schoolId","classId","subjectId","termId");
CREATE INDEX "AssessmentQuestion_schoolId_teacherMembershipId_createdAt_idx"
  ON "AssessmentQuestion"("schoolId","teacherMembershipId","createdAt");
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_sessionId_fkey"
  FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_sessionId_termId_fkey"
  FOREIGN KEY ("schoolId","sessionId","termId") REFERENCES "AcademicTerm"("schoolId","sessionId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_classId_fkey"
  FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_subjectId_fkey"
  FOREIGN KEY ("schoolId","subjectId") REFERENCES "Subject"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_schoolId_teacherMembershipId_fkey"
  FOREIGN KEY ("schoolId","teacherMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_exact_assignment_fkey"
  FOREIGN KEY ("schoolId","assignmentId","teacherMembershipId","classId","subjectId","sessionId")
  REFERENCES "TeacherClassSubjectAssignment"("schoolId","id","membershipId","classId","subjectId","sessionId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentQuestionKey" (
  "questionId" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "correctIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentQuestionKey_pkey" PRIMARY KEY ("questionId"),
  CONSTRAINT "AssessmentQuestionKey_index_check" CHECK ("correctIndex" BETWEEN 0 AND 5)
);
CREATE UNIQUE INDEX "AssessmentQuestionKey_schoolId_questionId_key"
  ON "AssessmentQuestionKey"("schoolId","questionId");
ALTER TABLE "AssessmentQuestionKey" ADD CONSTRAINT "AssessmentQuestionKey_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestionKey" ADD CONSTRAINT "AssessmentQuestionKey_question_fkey"
  FOREIGN KEY ("schoolId","questionId") REFERENCES "AssessmentQuestion"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_question"() RETURNS trigger AS $$
DECLARE options_count INTEGER;
BEGIN
  PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
    AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'School is inactive' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" author
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=author."schoolId"
      AND assignment."membershipId"=author."id"
      AND assignment."id"=NEW."assignmentId"
      AND assignment."classId"=NEW."classId"
      AND assignment."subjectId"=NEW."subjectId"
      AND assignment."sessionId"=NEW."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" session
      ON session."schoolId"=assignment."schoolId"
      AND session."id"=assignment."sessionId"
      AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term
      ON term."schoolId"=assignment."schoolId"
      AND term."sessionId"=session."id"
      AND term."id"=NEW."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=assignment."schoolId"
      AND c."id"=assignment."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=c."schoolId"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=assignment."schoolId"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE author."schoolId"=NEW."schoolId"
      AND author."id"=NEW."teacherMembershipId"
      AND author."userId"=NEW."teacherUserId"
      AND author."role"='TEACHER' AND author."isActive"=true
  ) THEN RAISE EXCEPTION 'Exact active teacher assignment required'
    USING ERRCODE='23503'; END IF;
  options_count := jsonb_array_length(NEW."options");
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW."options") value
    WHERE jsonb_typeof(value) <> 'string'
      OR char_length(btrim(value #>> '{}')) NOT BETWEEN 1 AND 500
  ) OR options_count <> (
    SELECT COUNT(DISTINCT lower(btrim(value #>> '{}')))
      FROM jsonb_array_elements(NEW."options") value
  ) THEN
    RAISE EXCEPTION 'Answers must have distinct nonempty option strings'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentQuestion_validate" BEFORE INSERT ON "AssessmentQuestion"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_question"();

CREATE FUNCTION "validate_assessment_question_key"() RETURNS trigger AS $$
DECLARE choices INTEGER;
BEGIN
  SELECT jsonb_array_length(question."options") INTO choices
    FROM "AssessmentQuestion" question
    WHERE question."schoolId"=NEW."schoolId"
      AND question."id"=NEW."questionId" FOR UPDATE;
  IF choices IS NULL OR NEW."correctIndex" < 0 OR NEW."correctIndex" >= choices THEN
    RAISE EXCEPTION 'Secret answer key is outside the exact question choices'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentQuestionKey_validate"
 BEFORE INSERT ON "AssessmentQuestionKey"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_question_key"();

-- Existing immutable history functions use the same tenant deletion
-- convention; direct UPDATE/DELETE/TRUNCATE are always prohibited.
CREATE TRIGGER "AssessmentQuestion_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentQuestion"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentQuestionKey_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentQuestionKey"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentQuestion_no_truncate"
 BEFORE TRUNCATE ON "AssessmentQuestion"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentQuestionKey_no_truncate"
 BEFORE TRUNCATE ON "AssessmentQuestionKey"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

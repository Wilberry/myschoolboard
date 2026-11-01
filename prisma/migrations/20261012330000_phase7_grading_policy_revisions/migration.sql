-- Phase 7: append-only, PREVIEW-ONLY school grading policy revisions.
-- Explicit weights, no universal grading policy or official student results.
CREATE TABLE "AssessmentGradingPolicyRevision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "quizWeight" INTEGER NOT NULL,
  "testWeight" INTEGER NOT NULL,
  "examWeight" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentGradingPolicyRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentGradingPolicyRevision_weights_check" CHECK (
    "version" >= 1 AND
    "quizWeight" BETWEEN 0 AND 100 AND
    "testWeight" BETWEEN 0 AND 100 AND
    "examWeight" BETWEEN 0 AND 100 AND
    ("quizWeight"+"testWeight"+"examWeight")=100
  ),
  CONSTRAINT "AssessmentGradingPolicyRevision_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentGradingPolicyRevision_context_version_key"
  ON "AssessmentGradingPolicyRevision"
  ("schoolId","sessionId","termId","classId","subjectId","version");
CREATE INDEX "AssessmentGradingPolicyRevision_schoolId_classId_subjectId_termId_idx"
  ON "AssessmentGradingPolicyRevision"("schoolId","classId","subjectId","termId");
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_session_fkey"
  FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_term_fkey"
  FOREIGN KEY ("schoolId","sessionId","termId")
  REFERENCES "AcademicTerm"("schoolId","sessionId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_schoolClass_fkey"
  FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_subject_fkey"
  FOREIGN KEY ("schoolId","subjectId") REFERENCES "Subject"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentGradingPolicyRevision"
  ADD CONSTRAINT "AssessmentGradingPolicyRevision_actor_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId")
  REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_grading_policy_revision"()
RETURNS trigger AS $$
DECLARE next_version INTEGER;
BEGIN
  -- All profile writers are serialized under the existing school row lock.
  PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
    AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for grading policy'
      USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    JOIN "AcademicSession" period ON period."schoolId"=actor."schoolId"
      AND period."id"=NEW."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=period."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=NEW."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" classroom ON classroom."schoolId"=actor."schoolId"
      AND classroom."id"=NEW."classId" AND classroom."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=classroom."schoolId"
      AND section."id"=classroom."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=actor."schoolId"
      AND subject."id"=NEW."subjectId" AND subject."isActive"=true
    WHERE actor."schoolId"=NEW."schoolId"
      AND actor."id"=NEW."actorMembershipId"
      AND actor."userId"=NEW."actorUserId"
      AND actor."isActive"=true AND actor."role"='SCHOOL_SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Only current school super admin may author exact academic grading draft'
      USING ERRCODE='23503';
  END IF;
  SELECT COALESCE(MAX(policy."version"),0)::int + 1 INTO next_version
    FROM "AssessmentGradingPolicyRevision" policy
    WHERE policy."schoolId"=NEW."schoolId"
      AND policy."sessionId"=NEW."sessionId"
      AND policy."termId"=NEW."termId"
      AND policy."classId"=NEW."classId"
      AND policy."subjectId"=NEW."subjectId";
  NEW."version" := next_version;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentGradingPolicyRevision_validate"
 BEFORE INSERT ON "AssessmentGradingPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_grading_policy_revision"();
CREATE TRIGGER "AssessmentGradingPolicyRevision_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentGradingPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentGradingPolicyRevision_no_truncate"
 BEFORE TRUNCATE ON "AssessmentGradingPolicyRevision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Phase 8: explicit school super-admin academic grading ADOPTION, not report release.
-- Versioned immutable adopted policy references the exact school draft.
CREATE UNIQUE INDEX "AssessmentGradingPolicyRevision_schoolId_id_key"
  ON "AssessmentGradingPolicyRevision"("schoolId","id");
CREATE TABLE "ResultGradingAdoption"(
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "policyId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
 "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "ordinal" INTEGER NOT NULL DEFAULT 1,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultGradingAdoption_pkey" PRIMARY KEY("id"),
 CONSTRAINT "ResultGradingAdoption_ordinal_check" CHECK ("ordinal" >= 1),
 CONSTRAINT "ResultGradingAdoption_reason_check"
  CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ResultGradingAdoption_schoolId_id_key"
 ON "ResultGradingAdoption"("schoolId","id");
CREATE UNIQUE INDEX "ResultGradingAdoption_schoolId_policyId_key"
 ON "ResultGradingAdoption"("schoolId","policyId");
CREATE UNIQUE INDEX "ResultGradingAdoption_context_ordinal_key"
 ON "ResultGradingAdoption"("schoolId","sessionId","termId","classId","subjectId","ordinal");
CREATE INDEX "ResultGradingAdoption_schoolId_classId_subjectId_termId_idx"
 ON "ResultGradingAdoption"("schoolId","classId","subjectId","termId");
ALTER TABLE "ResultGradingAdoption" ADD CONSTRAINT "ResultGradingAdoption_schoolId_fkey"
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultGradingAdoption" ADD CONSTRAINT "ResultGradingAdoption_policy_fkey"
 FOREIGN KEY("schoolId","policyId")
 REFERENCES "AssessmentGradingPolicyRevision"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultGradingAdoption" ADD CONSTRAINT "ResultGradingAdoption_actor_fkey"
 FOREIGN KEY("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_result_grading_adoption"() RETURNS trigger AS $$
DECLARE next_ordinal INTEGER;
BEGIN
 PERFORM 1 FROM "School" school
 WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active school required' USING ERRCODE='23503'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "AssessmentGradingPolicyRevision" policy
  JOIN "Membership" actor ON actor."schoolId"=policy."schoolId"
   AND actor."id"=NEW."actorMembershipId"
   AND actor."userId"=NEW."actorUserId" AND actor."isActive"=true
   AND actor."role"='SCHOOL_SUPER_ADMIN'
  JOIN "AcademicSession" session ON session."schoolId"=policy."schoolId"
   AND session."id"=policy."sessionId" AND session."status"='ACTIVE'
  JOIN "AcademicTerm" term ON term."schoolId"=policy."schoolId"
   AND term."sessionId"=session."id"
   AND term."id"=policy."termId" AND term."status"='ACTIVE'
  JOIN "SchoolClass" room ON room."schoolId"=policy."schoolId"
   AND room."id"=policy."classId" AND room."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
   AND section."id"=room."sectionId" AND section."isActive"=true
  JOIN "Subject" subject ON subject."schoolId"=policy."schoolId"
   AND subject."id"=policy."subjectId" AND subject."isActive"=true
  WHERE policy."schoolId"=NEW."schoolId" AND policy."id"=NEW."policyId"
   AND policy."sessionId"=NEW."sessionId"
   AND policy."termId"=NEW."termId"
   AND policy."classId"=NEW."classId"
   AND policy."subjectId"=NEW."subjectId"
   AND policy."quizWeight"+policy."testWeight"+policy."examWeight"=100
 ) THEN RAISE EXCEPTION 'Current exact school grading policy and administrator required'
   USING ERRCODE='23503'; END IF;
 IF EXISTS (SELECT 1 FROM "ResultGradingAdoption" a
  WHERE a."schoolId"=NEW."schoolId" AND a."policyId"=NEW."policyId")
 THEN RAISE EXCEPTION 'Policy revision already adopted'
  USING ERRCODE='23505'; END IF;
 SELECT COALESCE(MAX(a."ordinal"),0)::int+1 INTO next_ordinal
 FROM "ResultGradingAdoption" a
 WHERE a."schoolId"=NEW."schoolId"
  AND a."sessionId"=NEW."sessionId"
  AND a."termId"=NEW."termId"
  AND a."classId"=NEW."classId"
  AND a."subjectId"=NEW."subjectId";
 NEW."ordinal":=next_ordinal;
 NEW."adoptedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultGradingAdoption_validate"
 BEFORE INSERT ON "ResultGradingAdoption"
 FOR EACH ROW EXECUTE FUNCTION "validate_result_grading_adoption"();
CREATE TRIGGER "ResultGradingAdoption_immutable"
 BEFORE UPDATE OR DELETE ON "ResultGradingAdoption"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultGradingAdoption_no_truncate"
 BEFORE TRUNCATE ON "ResultGradingAdoption"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

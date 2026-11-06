-- Phase 9 student fee obligation issuance. Evidence is an immutable charge,
-- not a verified payment, allocation or proof of funds.
-- Forward-only additive migration; depends on fee configuration foundation.
CREATE UNIQUE INDEX "FeeStructureRevision_charge_identity"
  ON "FeeStructureRevision"("schoolId","id","categoryId","sessionId","termId");

CREATE TABLE "FeeObligation" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "issuerMembershipId" TEXT NOT NULL,
  "issuerUserId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeObligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeObligation_values_check" CHECK (
    "amountMinor">0 AND "amountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    AND "reason"=btrim("reason")
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "FeeObligation_schoolId_id_key"
  ON "FeeObligation"("schoolId","id");
CREATE UNIQUE INDEX "FeeObligation_schoolId_requestKey_key"
  ON "FeeObligation"("schoolId","requestKey");
CREATE UNIQUE INDEX "FeeObligation_student_category_period_key"
  ON "FeeObligation"("schoolId","studentId","sessionId","termId","categoryId");
CREATE INDEX "FeeObligation_schoolId_enrollmentId_issuedAt_idx"
  ON "FeeObligation"("schoolId","enrollmentId","issuedAt");
ALTER TABLE "FeeObligation"
  ADD CONSTRAINT "FeeObligation_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_student_fkey"
    FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_enrollment_fkey"
    FOREIGN KEY ("schoolId","enrollmentId","studentId","classId","sessionId")
      REFERENCES "StudentEnrollment"("schoolId","id","studentId","classId","sessionId")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_class_fkey"
    FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_session_fkey"
    FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_term_fkey"
    FOREIGN KEY ("schoolId","sessionId","termId")
      REFERENCES "AcademicTerm"("schoolId","sessionId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_category_fkey"
    FOREIGN KEY ("schoolId","categoryId") REFERENCES "FeeCategory"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_revision_fkey"
    FOREIGN KEY ("schoolId","revisionId","categoryId","sessionId","termId")
      REFERENCES "FeeStructureRevision"("schoolId","id","categoryId","sessionId","termId")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeObligation_issuer_fkey"
    FOREIGN KEY ("schoolId","issuerMembershipId") REFERENCES "Membership"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_fee_obligation_insert"() RETURNS trigger AS $$
DECLARE
  source_revision RECORD;
  pupil_enrollment RECORD;
BEGIN
  -- Serializes duplicate assignments with policy revisions per school.
  PERFORM 1 FROM "School" school
  WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for fee obligation'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" issuer
    WHERE issuer."schoolId"=NEW."schoolId"
      AND issuer."id"=NEW."issuerMembershipId"
      AND issuer."userId"=NEW."issuerUserId"
      AND issuer."isActive"=true AND issuer."role"='SCHOOL_SUPER_ADMIN'
  ) THEN RAISE EXCEPTION 'Current fee issuer not authorized'
    USING ERRCODE='23503'; END IF;

  SELECT revision."categoryId", revision."sessionId", revision."termId",
    revision."scope", revision."scopeId", revision."amountMinor", revision."currency"
    INTO source_revision
  FROM "FeeStructureRevision" revision
  JOIN "AcademicSession" session ON session."schoolId"=revision."schoolId"
    AND session."id"=revision."sessionId"
    AND session."status" IN ('PLANNED','ACTIVE')
  JOIN "AcademicTerm" term ON term."schoolId"=revision."schoolId"
    AND term."sessionId"=revision."sessionId"
    AND term."id"=revision."termId"
    AND term."status" IN ('PLANNED','ACTIVE')
  WHERE revision."schoolId"=NEW."schoolId"
    AND revision."id"=NEW."revisionId"
    -- New obligations may not silently select a superseded fee price.
    AND NOT EXISTS (
      SELECT 1 FROM "FeeStructureRevision" newer
      WHERE newer."schoolId"=revision."schoolId"
        AND newer."categoryId"=revision."categoryId"
        AND newer."sessionId"=revision."sessionId"
        AND newer."termId"=revision."termId"
        AND newer."scope"=revision."scope"
        AND newer."scopeId"=revision."scopeId"
        AND newer."version">revision."version"
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Current fee revision and period required'
    USING ERRCODE='23503'; END IF;

  SELECT e."studentId", e."classId", e."sessionId",
    schoolclass."sectionId" INTO pupil_enrollment
  FROM "StudentEnrollment" e
  JOIN "StudentRecord" pupil ON pupil."schoolId"=e."schoolId"
    AND pupil."id"=e."studentId" AND pupil."status"='ENROLLED'
  JOIN "SchoolClass" schoolclass ON schoolclass."schoolId"=e."schoolId"
    AND schoolclass."id"=e."classId" AND schoolclass."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=schoolclass."schoolId"
    AND section."id"=schoolclass."sectionId" AND section."isActive"=true
  WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."enrollmentId"
    AND e."status"='ACTIVE'
    AND e."sessionId"=source_revision."sessionId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact active enrolled pupil required'
    USING ERRCODE='23503'; END IF;
  IF NOT (
    (source_revision."scope"='SCHOOL' AND source_revision."scopeId"=NEW."schoolId")
    OR (source_revision."scope"='SECTION'
      AND source_revision."scopeId"=pupil_enrollment."sectionId")
    OR (source_revision."scope"='CLASS'
      AND source_revision."scopeId"=pupil_enrollment."classId")
  ) THEN RAISE EXCEPTION 'Pupil not in selected fee scope'
    USING ERRCODE='23503'; END IF;

  -- Copy all charge identity and money from trusted current DB resources.
  -- Attempts to fabricate amount/currency/student/term in raw SQL are ignored.
  NEW."studentId":=pupil_enrollment."studentId";
  NEW."classId":=pupil_enrollment."classId";
  NEW."sessionId":=source_revision."sessionId";
  NEW."termId":=source_revision."termId";
  NEW."categoryId":=source_revision."categoryId";
  NEW."amountMinor":=source_revision."amountMinor";
  NEW."currency":=source_revision."currency";
  NEW."issuedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FeeObligation_validate"
 BEFORE INSERT ON "FeeObligation" FOR EACH ROW
 EXECUTE FUNCTION "validate_fee_obligation_insert"();
CREATE TRIGGER "FeeObligation_immutable"
 BEFORE UPDATE OR DELETE ON "FeeObligation" FOR EACH ROW
 EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeObligation_no_truncate"
 BEFORE TRUNCATE ON "FeeObligation" FOR EACH STATEMENT
 EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

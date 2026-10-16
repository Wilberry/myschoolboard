-- FEE-REQ-001 / Phase 9 foundation. Configuration ONLY: no pupil debts or payments.
-- All original records remain unchanged. Versioned definitions never reprice
-- already-issued obligations. Explicitly apply only to a disposable DB first.
CREATE TYPE "FeeScope" AS ENUM ('SCHOOL', 'SECTION', 'CLASS');

CREATE TABLE "FeeCategory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeCategory_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  CONSTRAINT "FeeCategory_name_check" CHECK (
    char_length("name") BETWEEN 3 AND 120 AND "name"=btrim("name")
  )
);
CREATE UNIQUE INDEX "FeeCategory_schoolId_id_key" ON "FeeCategory"("schoolId","id");
CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "FeeCategory"("schoolId","code");
CREATE INDEX "FeeCategory_schoolId_createdAt_idx" ON "FeeCategory"("schoolId","createdAt");
ALTER TABLE "FeeCategory"
  ADD CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId")
  REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeCategory"
  ADD CONSTRAINT "FeeCategory_actor_fkey" FOREIGN KEY ("schoolId","actorMembershipId")
  REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "FeeStructureRevision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "scope" "FeeScope" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "sectionId" TEXT,
  "classId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeStructureRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeStructureRevision_values_check" CHECK (
    "version">=1 AND "amountMinor">0 AND "amountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
    AND "reason"=btrim("reason")
  ),
  CONSTRAINT "FeeStructureRevision_scope_check" CHECK (
    ("scope"='SCHOOL' AND "scopeId"="schoolId"
      AND "sectionId" IS NULL AND "classId" IS NULL)
    OR ("scope"='SECTION' AND "scopeId"="sectionId"
      AND "sectionId" IS NOT NULL AND "classId" IS NULL)
    OR ("scope"='CLASS' AND "scopeId"="classId"
      AND "classId" IS NOT NULL AND "sectionId" IS NULL)
  )
);
CREATE UNIQUE INDEX "FeeStructureRevision_schoolId_id_key"
  ON "FeeStructureRevision"("schoolId","id");
CREATE UNIQUE INDEX "FeeStructureRevision_context_version_key"
  ON "FeeStructureRevision"
    ("schoolId","categoryId","sessionId","termId","scope","scopeId","version");
CREATE INDEX "FeeStructureRevision_schoolId_sessionId_termId_scope_scopeId_idx"
  ON "FeeStructureRevision"("schoolId","sessionId","termId","scope","scopeId");
ALTER TABLE "FeeStructureRevision"
  ADD CONSTRAINT "FeeStructureRevision_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_category_fkey"
    FOREIGN KEY ("schoolId","categoryId") REFERENCES "FeeCategory"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_session_fkey"
    FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_term_fkey"
    FOREIGN KEY ("schoolId","sessionId","termId")
    REFERENCES "AcademicTerm"("schoolId","sessionId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_section_fkey"
    FOREIGN KEY ("schoolId","sectionId") REFERENCES "SchoolSection"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_class_fkey"
    FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeStructureRevision_actor_fkey"
    FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
      ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_fee_category_insert"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for fee category'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId"
      AND m."id"=NEW."actorMembershipId"
      AND m."userId"=NEW."actorUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) THEN RAISE EXCEPTION 'Current school super admin required'
    USING ERRCODE='23503'; END IF;
  NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_fee_structure_revision_insert"() RETURNS trigger AS $$
DECLARE next_version INTEGER;
BEGIN
  -- Shared school lock serializes simultaneous revisions and category creation.
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for fee policy'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    JOIN "FeeCategory" cat ON cat."schoolId"=m."schoolId"
      AND cat."id"=NEW."categoryId"
    JOIN "AcademicSession" sess ON sess."schoolId"=m."schoolId"
      AND sess."id"=NEW."sessionId" AND sess."status" IN ('PLANNED','ACTIVE')
    JOIN "AcademicTerm" term ON term."schoolId"=sess."schoolId"
      AND term."sessionId"=sess."id" AND term."id"=NEW."termId"
      AND term."status" IN ('PLANNED','ACTIVE')
    WHERE m."schoolId"=NEW."schoolId"
      AND m."id"=NEW."actorMembershipId"
      AND m."userId"=NEW."actorUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) THEN RAISE EXCEPTION 'Invalid fee category, period or school actor'
    USING ERRCODE='23503'; END IF;
  IF NEW."scope"='SECTION' AND NOT EXISTS (
    SELECT 1 FROM "SchoolSection" section
    WHERE section."schoolId"=NEW."schoolId" AND section."id"=NEW."sectionId"
      AND section."isActive"=true
  ) THEN RAISE EXCEPTION 'Active exact school section required'
    USING ERRCODE='23503'; END IF;
  IF NEW."scope"='CLASS' AND NOT EXISTS (
    SELECT 1 FROM "SchoolClass" classroom
    JOIN "SchoolSection" section ON section."schoolId"=classroom."schoolId"
      AND section."id"=classroom."sectionId" AND section."isActive"=true
    WHERE classroom."schoolId"=NEW."schoolId"
      AND classroom."id"=NEW."classId" AND classroom."isActive"=true
  ) THEN RAISE EXCEPTION 'Active exact school class required'
    USING ERRCODE='23503'; END IF;
  SELECT COALESCE(MAX(pr."version"),0)::integer+1 INTO next_version
  FROM "FeeStructureRevision" pr
  WHERE pr."schoolId"=NEW."schoolId" AND pr."categoryId"=NEW."categoryId"
    AND pr."sessionId"=NEW."sessionId" AND pr."termId"=NEW."termId"
    AND pr."scope"=NEW."scope" AND pr."scopeId"=NEW."scopeId";
  NEW."version":=next_version;
  NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeeCategory_validate"
 BEFORE INSERT ON "FeeCategory" FOR EACH ROW
 EXECUTE FUNCTION "validate_fee_category_insert"();
CREATE TRIGGER "FeeStructureRevision_validate"
 BEFORE INSERT ON "FeeStructureRevision" FOR EACH ROW
 EXECUTE FUNCTION "validate_fee_structure_revision_insert"();
CREATE TRIGGER "FeeCategory_immutable"
 BEFORE UPDATE OR DELETE ON "FeeCategory" FOR EACH ROW
 EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeCategory_no_truncate"
 BEFORE TRUNCATE ON "FeeCategory" FOR EACH STATEMENT
 EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "FeeStructureRevision_immutable"
 BEFORE UPDATE OR DELETE ON "FeeStructureRevision" FOR EACH ROW
 EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeStructureRevision_no_truncate"
 BEFORE TRUNCATE ON "FeeStructureRevision" FOR EACH STATEMENT
 EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

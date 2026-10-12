-- Additive Phase 6 correction ledger. No existing attendance marks are changed.
-- Corrections are separate immutable requests + independently scoped decisions.
-- Never migrate, repair, or silently fabricate historical student records.
CREATE UNIQUE INDEX "AttendanceEntry_correction_identity"
ON "AttendanceEntry" ("schoolId", "id", "registerId");

CREATE TABLE "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "expectedMark" "AttendanceMark" NOT NULL,
  "proposedMark" "AttendanceMark" NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestedByMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCorrectionRequest_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "AttendanceCorrectionRequest_mark_change_check" CHECK ("expectedMark" <> "proposedMark"),
  CONSTRAINT "AttendanceCorrectionRequest_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "AttendanceCorrectionRequest_decision_identity"
ON "AttendanceCorrectionRequest" ("schoolId", "id", "registerId");
CREATE UNIQUE INDEX "AttendanceCorrectionRequest_schoolId_entryId_revision_key"
ON "AttendanceCorrectionRequest" ("schoolId", "entryId", "revision");
CREATE INDEX "AttendanceCorrectionRequest_schoolId_registerId_createdAt_idx"
ON "AttendanceCorrectionRequest" ("schoolId", "registerId", "createdAt");
ALTER TABLE "AttendanceCorrectionRequest"
  ADD CONSTRAINT "AttendanceCorrectionRequest_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest"
  ADD CONSTRAINT "AttendanceCorrectionRequest_entry_fkey"
  FOREIGN KEY ("schoolId", "entryId", "registerId")
  REFERENCES "AttendanceEntry"("schoolId", "id", "registerId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest"
  ADD CONSTRAINT "AttendanceCorrectionRequest_requester_fkey"
  FOREIGN KEY ("schoolId", "requestedByMembershipId")
  REFERENCES "Membership"("schoolId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AttendanceCorrectionDecision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "reviewerMembershipId" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrectionDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCorrectionDecision_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "AttendanceCorrectionDecision_schoolId_requestId_key"
ON "AttendanceCorrectionDecision" ("schoolId", "requestId");
CREATE INDEX "AttendanceCorrectionDecision_schoolId_reviewerUserId_createdAt_idx"
ON "AttendanceCorrectionDecision" ("schoolId", "reviewerUserId", "createdAt");
ALTER TABLE "AttendanceCorrectionDecision"
  ADD CONSTRAINT "AttendanceCorrectionDecision_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionDecision"
  ADD CONSTRAINT "AttendanceCorrectionDecision_request_fkey"
  FOREIGN KEY ("schoolId", "requestId", "registerId")
  REFERENCES "AttendanceCorrectionRequest"("schoolId", "id", "registerId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionDecision"
  ADD CONSTRAINT "AttendanceCorrectionDecision_reviewer_fkey"
  FOREIGN KEY ("schoolId", "reviewerMembershipId")
  REFERENCES "Membership"("schoolId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Lock the exact immutable entry. Also serializes two raw SQL requests to the
-- same student register, independent of API/application implementation.
CREATE FUNCTION "validate_attendance_correction_request"() RETURNS trigger AS $$
DECLARE
  original_mark "AttendanceMark";
  effective_mark "AttendanceMark";
  next_revision INTEGER;
BEGIN
  SELECT e."mark" INTO original_mark
    FROM "AttendanceEntry" e
    WHERE e."id" = NEW."entryId"
      AND e."schoolId" = NEW."schoolId"
      AND e."registerId" = NEW."registerId"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown school-bound attendance entry'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "AttendanceEntry" e
    JOIN "AttendanceRegister" r
      ON r."id" = e."registerId" AND r."schoolId" = e."schoolId"
    JOIN "School" school
      ON school."id" = r."schoolId" AND school."isActive" = true
    JOIN "AcademicSession" session
      ON session."id" = r."sessionId" AND session."schoolId" = r."schoolId"
      AND session."status" = 'ACTIVE'
    JOIN "SchoolClass" c
      ON c."id" = r."classId" AND c."schoolId" = r."schoolId"
      AND c."isActive" = true
    JOIN "SchoolSection" section
      ON section."id" = c."sectionId" AND section."schoolId" = c."schoolId"
      AND section."isActive" = true
    JOIN "Membership" actor
      ON actor."schoolId" = r."schoolId"
      AND actor."id" = NEW."requestedByMembershipId"
      AND actor."userId" = NEW."requestedByUserId"
      AND actor."role" IN ('TEACHER', 'FORM_TEACHER')
      AND actor."isActive" = true
    JOIN "FormTeacherResponsibility" responsibility
      ON responsibility."schoolId" = r."schoolId"
      AND responsibility."membershipId" = actor."id"
      AND responsibility."classId" = r."classId"
      AND responsibility."sessionId" = r."sessionId"
      AND responsibility."kind" = 'PRIMARY'
      AND responsibility."status" = 'ACTIVE'
    WHERE e."id" = NEW."entryId" AND e."schoolId" = NEW."schoolId"
      AND e."registerId" = NEW."registerId"
      AND r."status" = 'APPROVED'
      AND r."attendanceDate" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
  ) THEN
    RAISE EXCEPTION 'Correction requester lacks current exact Form Teacher authority'
      USING ERRCODE = '23503';
  END IF;

  -- Requests remain immutable; a new version is permitted only once the
  -- previous request has an immutable decision, even if returned.
  IF EXISTS (
    SELECT 1 FROM "AttendanceCorrectionRequest" prior
    LEFT JOIN "AttendanceCorrectionDecision" decision
      ON decision."schoolId" = prior."schoolId"
      AND decision."requestId" = prior."id"
    WHERE prior."schoolId" = NEW."schoolId"
      AND prior."entryId" = NEW."entryId"
      AND decision."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Outstanding correction requires review'
      USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(MAX(previous."revision"), 0) + 1 INTO next_revision
    FROM "AttendanceCorrectionRequest" previous
    WHERE previous."schoolId" = NEW."schoolId"
      AND previous."entryId" = NEW."entryId";
  SELECT COALESCE((
    SELECT approved_request."proposedMark"
    FROM "AttendanceCorrectionRequest" approved_request
    JOIN "AttendanceCorrectionDecision" decision
      ON decision."schoolId" = approved_request."schoolId"
      AND decision."requestId" = approved_request."id"
      AND decision."approved" = true
    WHERE approved_request."schoolId" = NEW."schoolId"
      AND approved_request."entryId" = NEW."entryId"
    ORDER BY approved_request."revision" DESC
    LIMIT 1
  ), original_mark) INTO effective_mark;

  IF NEW."revision" <> next_revision OR
     NEW."expectedMark" IS DISTINCT FROM effective_mark OR
     NEW."proposedMark" IS NOT DISTINCT FROM effective_mark THEN
    RAISE EXCEPTION 'Correction revision or expected mark is stale'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceCorrectionRequest_validate"
BEFORE INSERT ON "AttendanceCorrectionRequest"
FOR EACH ROW EXECUTE FUNCTION "validate_attendance_correction_request"();

-- Reviewer stage and SECTION scope use the register's actual stored class
-- relationship. A principal cannot impersonate an HM or self-approve.
-- The original register must remain APPROVED and the session active.
CREATE FUNCTION "validate_attendance_correction_decision"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AttendanceCorrectionRequest" correction
    JOIN "AttendanceEntry" e
      ON e."id" = correction."entryId"
      AND e."schoolId" = correction."schoolId"
      AND e."registerId" = correction."registerId"
    JOIN "AttendanceRegister" r
      ON r."id" = correction."registerId"
      AND r."schoolId" = correction."schoolId"
    JOIN "School" school
      ON school."id" = r."schoolId" AND school."isActive" = true
    JOIN "AcademicSession" period
      ON period."id" = r."sessionId" AND period."schoolId" = r."schoolId"
      AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c
      ON c."id" = r."classId" AND c."schoolId" = r."schoolId"
      AND c."isActive" = true
    JOIN "SchoolSection" section
      ON section."id" = c."sectionId" AND section."schoolId" = c."schoolId"
      AND section."isActive" = true
    JOIN "Membership" reviewer
      ON reviewer."schoolId" = r."schoolId"
      AND reviewer."id" = NEW."reviewerMembershipId"
      AND reviewer."userId" = NEW."reviewerUserId"
      AND reviewer."isActive" = true
    JOIN "ScopeGrant" grant
      ON grant."membershipId" = reviewer."id"
      AND grant."type" = 'SECTION'
      AND grant."scopeId" = section."id"
      AND grant."verified" = true
    WHERE correction."id" = NEW."requestId"
      AND correction."schoolId" = NEW."schoolId"
      AND correction."registerId" = NEW."registerId"
      AND correction."requestedByMembershipId" <> reviewer."id"
      AND r."status" = 'APPROVED'
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
  ) THEN
    RAISE EXCEPTION 'Correction reviewer lacks exact verified section authority'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceCorrectionDecision_validate"
BEFORE INSERT ON "AttendanceCorrectionDecision"
FOR EACH ROW EXECUTE FUNCTION "validate_attendance_correction_decision"();

-- No direct change to an immutable request/decision, no spoofed approvals.
-- Explicit tenant cleanup follows the existing nested cascade convention.
CREATE TRIGGER "AttendanceCorrectionRequest_immutable"
BEFORE UPDATE OR DELETE ON "AttendanceCorrectionRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "AttendanceCorrectionDecision_immutable"
BEFORE UPDATE OR DELETE ON "AttendanceCorrectionDecision"
FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "AttendanceCorrectionRequest_no_truncate"
BEFORE TRUNCATE ON "AttendanceCorrectionRequest"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "AttendanceCorrectionDecision_no_truncate"
BEFORE TRUNCATE ON "AttendanceCorrectionDecision"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

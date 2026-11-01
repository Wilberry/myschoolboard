-- Phase 6 additive policy foundations. Review-only; no data backfill.
-- Defaults for schools without policy rows: Etc/UTC, submit past 7 days,
-- correction window 30 days. All timestamps and original marks immutable.
CREATE TABLE "SchoolAttendancePolicyRevision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "timeZone" VARCHAR(64) NOT NULL,
  "submissionBackdateDays" INTEGER NOT NULL,
  "correctionWindowDays" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolAttendancePolicyRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolAttendancePolicyRevision_rules" CHECK (
    "revision" > 0 AND
    "submissionBackdateDays" BETWEEN 0 AND 30 AND
    "correctionWindowDays" BETWEEN 0 AND 365 AND
    char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "SchoolAttendancePolicyRevision_schoolId_revision_key"
  ON "SchoolAttendancePolicyRevision"("schoolId", "revision");
CREATE INDEX "SchoolAttendancePolicyRevision_schoolId_createdAt_idx"
  ON "SchoolAttendancePolicyRevision"("schoolId", "createdAt");
ALTER TABLE "SchoolAttendancePolicyRevision"
  ADD CONSTRAINT "SchoolAttendancePolicyRevision_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolAttendancePolicyRevision"
  ADD CONSTRAINT "SchoolAttendancePolicyRevision_actor_fkey"
  FOREIGN KEY ("schoolId", "actorMembershipId")
  REFERENCES "Membership"("schoolId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Direct SQL must not bypass administrative identity, valid timezone, or the
-- exact next revision. This is a history row, never an UPDATE to old settings.
CREATE FUNCTION "validate_school_attendance_policy_revision"()
RETURNS trigger AS $$
DECLARE
  current_revision INTEGER;
BEGIN
  PERFORM 1 FROM "School" s
    WHERE s."id" = NEW."schoolId" AND s."isActive" = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for policy revision'
      USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" member
    WHERE member."schoolId" = NEW."schoolId"
      AND member."id" = NEW."actorMembershipId"
      AND member."userId" = NEW."actorUserId"
      AND member."isActive" = true
      AND member."role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_timezone_names tz WHERE tz.name = NEW."timeZone"
  ) THEN
    RAISE EXCEPTION 'Policy needs authorized school administrator and supported timezone'
      USING ERRCODE = '23503';
  END IF;
  SELECT COALESCE(MAX("revision"), 0) INTO current_revision
    FROM "SchoolAttendancePolicyRevision" WHERE "schoolId" = NEW."schoolId";
  IF NEW."revision" <> current_revision + 1 THEN
    RAISE EXCEPTION 'School attendance policy revision must advance by one'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SchoolAttendancePolicyRevision_validate"
  BEFORE INSERT ON "SchoolAttendancePolicyRevision"
  FOR EACH ROW EXECUTE FUNCTION "validate_school_attendance_policy_revision"();

-- The existing attendance SQL still enforces UTC nonfuture dates.
-- These extra checks may RESTRICT but never expand prior authority.
CREATE FUNCTION "validate_school_attendance_window"()
RETURNS trigger AS $$
DECLARE
  zone_name TEXT := 'Etc/UTC';
  submit_days INTEGER := 7;
  correction_days INTEGER := 30;
  record_date DATE;
  local_today DATE;
  date_age INTEGER;
BEGIN
  -- The same function handles two different record shapes. Never access
  -- eventType on AttendanceCorrectionRequest (which has no such column).
  IF TG_TABLE_NAME = 'AttendanceEvent' THEN
    IF NEW."eventType" <> 'SUBMITTED' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME <> 'AttendanceCorrectionRequest' THEN
    RAISE EXCEPTION 'Unsupported attendance calendar trigger table'
      USING ERRCODE = '23514';
  END IF;

  -- Serialize policy edits and direct attendance/correction writes on the
  -- existing school lock, including writers that bypass the Next API.
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId" AND school."isActive" = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for attendance calendar checks'
      USING ERRCODE = '23503';
  END IF;

  SELECT policy."timeZone", policy."submissionBackdateDays",
         policy."correctionWindowDays"
    INTO zone_name, submit_days, correction_days
    FROM "SchoolAttendancePolicyRevision" policy
    WHERE policy."schoolId" = NEW."schoolId"
    ORDER BY policy."revision" DESC LIMIT 1;
  zone_name := COALESCE(zone_name, 'Etc/UTC');
  submit_days := COALESCE(submit_days, 7);
  correction_days := COALESCE(correction_days, 30);
  local_today := (CURRENT_TIMESTAMP AT TIME ZONE zone_name)::date;

  IF TG_TABLE_NAME = 'AttendanceEvent' THEN
    SELECT r."attendanceDate" INTO record_date
      FROM "AttendanceRegister" r
      WHERE r."schoolId" = NEW."schoolId"
        AND r."id" = NEW."registerId";
    date_age := local_today - record_date;
    IF date_age IS NULL OR date_age < 0 OR date_age > submit_days OR
       record_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Etc/UTC')::date THEN
      RAISE EXCEPTION 'Attendance submission outside school calendar window'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    -- BEFORE INSERT: reference the existing register, not the new request row.
    SELECT r."attendanceDate" INTO record_date
      FROM "AttendanceRegister" r
      WHERE r."id" = NEW."registerId"
        AND r."schoolId" = NEW."schoolId";
    date_age := local_today - record_date;
    IF date_age IS NULL OR date_age < 0 OR date_age > correction_days THEN
      RAISE EXCEPTION 'Attendance correction outside school calendar window'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AttendanceEvent_school_calendar"
  BEFORE INSERT ON "AttendanceEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_school_attendance_window"();
CREATE TRIGGER "AttendanceCorrectionRequest_school_calendar"
  BEFORE INSERT ON "AttendanceCorrectionRequest"
  FOR EACH ROW EXECUTE FUNCTION "validate_school_attendance_window"();

CREATE TRIGGER "SchoolAttendancePolicyRevision_immutable"
  BEFORE UPDATE OR DELETE ON "SchoolAttendancePolicyRevision"
  FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "SchoolAttendancePolicyRevision_no_truncate"
  BEFORE TRUNCATE ON "SchoolAttendancePolicyRevision"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

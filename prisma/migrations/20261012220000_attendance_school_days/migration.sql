-- Additive Phase 6 school non-teaching-day revisions. No default weekend
-- exclusion and no rewriting of already submitted attendance.
CREATE TABLE "SchoolAttendanceDayRevision" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "attendanceDate" DATE NOT NULL, "revision" INTEGER NOT NULL,
  "isTeachingDay" BOOLEAN NOT NULL, "reason" VARCHAR(500) NOT NULL,
  "actorUserId" TEXT NOT NULL, "actorMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolAttendanceDayRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolAttendanceDayRevision_guard" CHECK (
    "revision" > 0 AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "SchoolAttendanceDayRevision_schoolId_attendanceDate_revision_key"
  ON "SchoolAttendanceDayRevision"("schoolId", "attendanceDate", "revision");
CREATE INDEX "SchoolAttendanceDayRevision_schoolId_attendanceDate_createdAt_idx"
  ON "SchoolAttendanceDayRevision"("schoolId", "attendanceDate", "createdAt");
ALTER TABLE "SchoolAttendanceDayRevision" ADD CONSTRAINT "SchoolAttendanceDayRevision_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolAttendanceDayRevision" ADD CONSTRAINT "SchoolAttendanceDayRevision_actor_fkey"
  FOREIGN KEY ("schoolId", "actorMembershipId") REFERENCES "Membership"("schoolId", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_attendance_day_revision"() RETURNS trigger AS $$
DECLARE next_revision INTEGER;
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId" AND school."isActive" = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required to designate teaching days' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    WHERE actor."schoolId" = NEW."schoolId"
      AND actor."id" = NEW."actorMembershipId"
      AND actor."userId" = NEW."actorUserId"
      AND actor."isActive" = true
      AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'School calendar requires active school administrator'
      USING ERRCODE='23503';
  END IF;
  -- Retrospective changes must never silently invalidate a real register.
  IF EXISTS (
    SELECT 1 FROM "AttendanceRegister" existing
    WHERE existing."schoolId" = NEW."schoolId"
      AND existing."attendanceDate" = NEW."attendanceDate"
  ) THEN
    RAISE EXCEPTION 'School teaching-day policy locked after attendance was recorded'
      USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX(revision),0)+1 INTO next_revision
    FROM "SchoolAttendanceDayRevision"
    WHERE "schoolId" = NEW."schoolId" AND "attendanceDate" = NEW."attendanceDate";
  IF NEW."revision" <> next_revision THEN
    RAISE EXCEPTION 'Teaching-day revision must advance exactly once'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SchoolAttendanceDayRevision_validate"
  BEFORE INSERT ON "SchoolAttendanceDayRevision"
  FOR EACH ROW EXECUTE FUNCTION "validate_attendance_day_revision"();

-- Apply to new submission events. The earlier event actor/roster/date
-- trigger checks remain in force; this additional trigger can only deny.
CREATE FUNCTION "validate_attendance_teaching_day"() RETURNS trigger AS $$
DECLARE blocked BOOLEAN;
BEGIN
  IF NEW."eventType" <> 'SUBMITTED' THEN RETURN NEW; END IF;
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId" AND school."isActive" = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required' USING ERRCODE='23503';
  END IF;
  SELECT NOT latest."isTeachingDay" INTO blocked
    FROM "AttendanceRegister" r
    JOIN LATERAL (
      SELECT policy."isTeachingDay"
      FROM "SchoolAttendanceDayRevision" policy
      WHERE policy."schoolId" = r."schoolId"
        AND policy."attendanceDate" = r."attendanceDate"
      ORDER BY policy."revision" DESC LIMIT 1
    ) latest ON true
    WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."registerId";
  IF COALESCE(blocked, false) THEN
    RAISE EXCEPTION 'Attendance cannot be submitted on designated non-teaching day'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceEvent_teaching_day"
  BEFORE INSERT ON "AttendanceEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_attendance_teaching_day"();

CREATE TRIGGER "SchoolAttendanceDayRevision_immutable"
  BEFORE UPDATE OR DELETE ON "SchoolAttendanceDayRevision"
  FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "SchoolAttendanceDayRevision_no_truncate"
  BEFORE TRUNCATE ON "SchoolAttendanceDayRevision"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

-- Phase 6 additive hardening, unexecuted review-only migration.
-- The original submission API already requires the complete active class roster.
-- Independent PostgreSQL enforcement is necessary: a forged direct SQL caller
-- must not satisfy the previous audit trigger using just one attendance mark.
--
-- This trigger runs on SUBMITTED audit INSERT after entries have been written
-- and BEFORE an immutable submission event can be committed. No existing
-- register/entry/audit history is altered or backfilled.

CREATE FUNCTION "validate_attendance_complete_roster"()
RETURNS trigger AS $$
DECLARE
  total_marks BIGINT;
  eligible_marks BIGINT;
  eligible_students BIGINT;
BEGIN
  IF NEW."eventType" <> 'SUBMITTED' THEN
    RETURN NEW;
  END IF;

  -- Own the same top-level tenant lock acquired by ordinary application
  -- attendance and enrollment mutations. Foreign-key KEY SHARE locks by
  -- concurrent enrollment inserts conflict with FOR UPDATE, preventing a
  -- partially counted roster from becoming authoritative at submission.
  PERFORM 1 FROM "School"
    WHERE "id" = NEW."schoolId" AND "isActive" = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance submission requires an active school'
      USING ERRCODE = '23503';
  END IF;

  SELECT
    (SELECT COUNT(*) FROM "AttendanceEntry" entry
      WHERE entry."schoolId" = r."schoolId"
        AND entry."registerId" = r."id"),
    (SELECT COUNT(*)
      FROM "AttendanceEntry" entry
      JOIN "StudentEnrollment" enrollment
        ON enrollment."id" = entry."enrollmentId"
        AND enrollment."schoolId" = entry."schoolId"
        AND enrollment."studentId" = entry."studentId"
        AND enrollment."classId" = r."classId"
        AND enrollment."sessionId" = r."sessionId"
        AND enrollment."status" = 'ACTIVE'
        AND enrollment."startedAt"::date <= r."attendanceDate"
      JOIN "StudentRecord" pupil
        ON pupil."id" = enrollment."studentId"
        AND pupil."schoolId" = enrollment."schoolId"
        AND pupil."status" = 'ENROLLED'
      WHERE entry."schoolId" = r."schoolId"
        AND entry."registerId" = r."id"),
    (SELECT COUNT(*)
      FROM "StudentEnrollment" enrollment
      JOIN "StudentRecord" pupil
        ON pupil."id" = enrollment."studentId"
        AND pupil."schoolId" = enrollment."schoolId"
        AND pupil."status" = 'ENROLLED'
      WHERE enrollment."schoolId" = r."schoolId"
        AND enrollment."sessionId" = r."sessionId"
        AND enrollment."classId" = r."classId"
        AND enrollment."status" = 'ACTIVE')
  INTO total_marks, eligible_marks, eligible_students
  FROM "AttendanceRegister" r
  WHERE r."id" = NEW."registerId"
    AND r."schoolId" = NEW."schoolId"
    AND r."status" = 'SUBMITTED';

  IF total_marks IS NULL OR total_marks < 1 OR total_marks > 500 OR
     total_marks <> eligible_students OR total_marks <> eligible_marks THEN
    RAISE EXCEPTION 'Attendance audit requires the exact complete active class roster'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AttendanceEvent_complete_roster"
BEFORE INSERT ON "AttendanceEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_attendance_complete_roster"();

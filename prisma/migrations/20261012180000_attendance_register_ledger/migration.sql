-- Phase 6 review-only additive attendance ledger. No backfill, seed or execution.
-- Lock exact actor responsibility and student/enrollment/class/session identity
-- at PostgreSQL as well as in the eventual server-side serializable service.
CREATE TYPE "AttendanceRegisterStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED');
CREATE TYPE "AttendanceMark" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
CREATE TYPE "AttendanceEventType" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED');

CREATE UNIQUE INDEX "FormTeacherResponsibility_attendance_identity"
ON "FormTeacherResponsibility"("schoolId", "id", "membershipId", "classId", "sessionId");
CREATE UNIQUE INDEX "StudentEnrollment_attendance_identity"
ON "StudentEnrollment"("schoolId", "id", "studentId", "classId", "sessionId");

CREATE TABLE "AttendanceRegister" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "attendanceDate" DATE NOT NULL,
  "status" "AttendanceRegisterStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedByMembershipId" TEXT NOT NULL,
  "formTeacherResponsibilityId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "AttendanceRegister_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceRegister_reviewed_consistency" CHECK (
    ("status" = 'SUBMITTED' AND "reviewedAt" IS NULL)
    OR ("status" IN ('APPROVED', 'RETURNED') AND "reviewedAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "AttendanceRegister_schoolId_id_key"
ON "AttendanceRegister"("schoolId", "id");
CREATE UNIQUE INDEX "AttendanceRegister_entry_identity"
ON "AttendanceRegister"("schoolId", "id", "sessionId", "classId");
CREATE UNIQUE INDEX "AttendanceRegister_schoolId_sessionId_classId_attendanceDate_key"
ON "AttendanceRegister"("schoolId", "sessionId", "classId", "attendanceDate");
CREATE INDEX "AttendanceRegister_schoolId_status_attendanceDate_idx"
ON "AttendanceRegister"("schoolId", "status", "attendanceDate");

ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId") REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_schoolId_classId_fkey"
FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_form_teacher_exact_fkey"
FOREIGN KEY ("schoolId", "formTeacherResponsibilityId", "submittedByMembershipId", "classId", "sessionId")
REFERENCES "FormTeacherResponsibility"("schoolId", "id", "membershipId", "classId", "sessionId")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AttendanceEntry" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "mark" "AttendanceMark" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceEntry_schoolId_registerId_studentId_key"
ON "AttendanceEntry"("schoolId", "registerId", "studentId");
CREATE INDEX "AttendanceEntry_schoolId_studentId_createdAt_idx"
ON "AttendanceEntry"("schoolId", "studentId", "createdAt");
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_register_exact_fkey"
FOREIGN KEY ("schoolId", "registerId", "sessionId", "classId")
REFERENCES "AttendanceRegister"("schoolId", "id", "sessionId", "classId")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceEntry" ADD CONSTRAINT "AttendanceEntry_enrollment_exact_fkey"
FOREIGN KEY ("schoolId", "enrollmentId", "studentId", "classId", "sessionId")
REFERENCES "StudentEnrollment"("schoolId", "id", "studentId", "classId", "sessionId")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AttendanceEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "AttendanceEventType" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceEvent_reason_check" CHECK (
    ("eventType" = 'SUBMITTED' AND "reason" IS NULL)
    OR ("eventType" IN ('APPROVED', 'RETURNED')
      AND "reason" IS NOT NULL
      AND char_length(btrim("reason")) BETWEEN 5 AND 500)
  )
);
CREATE UNIQUE INDEX "AttendanceEvent_schoolId_registerId_eventType_key"
ON "AttendanceEvent"("schoolId", "registerId", "eventType");
CREATE UNIQUE INDEX "AttendanceEvent_one_decision_per_register"
ON "AttendanceEvent"("schoolId", "registerId")
WHERE "eventType" IN ('APPROVED', 'RETURNED');
CREATE INDEX "AttendanceEvent_schoolId_actorUserId_createdAt_idx"
ON "AttendanceEvent"("schoolId", "actorUserId", "createdAt");
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_schoolId_registerId_fkey"
FOREIGN KEY ("schoolId", "registerId") REFERENCES "AttendanceRegister"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_actor_membership_fkey"
FOREIGN KEY ("schoolId", "actorMembershipId") REFERENCES "Membership"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- A register cannot be directly inserted in a decision state or rewritten to
-- change its original school, class, session, author, date or creation time.
CREATE FUNCTION "guard_attendance_register_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'SUBMITTED' OR NEW."reviewedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Attendance starts submitted' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW."id", NEW."schoolId", NEW."sessionId", NEW."classId",
         NEW."attendanceDate", NEW."submittedByMembershipId",
         NEW."formTeacherResponsibilityId", NEW."submittedAt")
     IS DISTINCT FROM
     ROW(OLD."id", OLD."schoolId", OLD."sessionId", OLD."classId",
         OLD."attendanceDate", OLD."submittedByMembershipId",
         OLD."formTeacherResponsibilityId", OLD."submittedAt") OR
     OLD."status" <> 'SUBMITTED' OR
     NEW."status" NOT IN ('APPROVED', 'RETURNED') OR
     NEW."reviewedAt" IS NULL THEN
    RAISE EXCEPTION 'Attendance register may transition only once to review decision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceRegister_guard"
BEFORE INSERT OR UPDATE ON "AttendanceRegister"
FOR EACH ROW EXECUTE FUNCTION "guard_attendance_register_mutation"();

-- No direct insert of a mark without an ACTIVE exact same-school enrollment
-- belonging to the register's class, session and marked student. The register
-- roster becomes immutable once its submission event is inserted.
CREATE FUNCTION "validate_attendance_entry"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AttendanceRegister" r
    JOIN "School" s ON s."id" = r."schoolId" AND s."isActive" = true
    JOIN "AcademicSession" session ON session."id" = r."sessionId"
      AND session."schoolId" = r."schoolId" AND session."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = r."classId"
      AND c."schoolId" = r."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "StudentEnrollment" e ON e."id" = NEW."enrollmentId"
      AND e."schoolId" = r."schoolId" AND e."classId" = r."classId"
      AND e."sessionId" = r."sessionId" AND e."studentId" = NEW."studentId"
      AND e."status" = 'ACTIVE'
    JOIN "StudentRecord" student ON student."id" = e."studentId"
      AND student."schoolId" = e."schoolId" AND student."status" = 'ENROLLED'
    WHERE r."id" = NEW."registerId" AND r."schoolId" = NEW."schoolId"
      AND NEW."sessionId" = r."sessionId" AND NEW."classId" = r."classId"
      AND r."status" = 'SUBMITTED'
      AND r."attendanceDate" BETWEEN session."startsOn" AND session."endsOn"
      AND r."attendanceDate" >= e."startedAt"::date
      AND NOT EXISTS (
        SELECT 1 FROM "AttendanceEvent" ev
        WHERE ev."schoolId" = r."schoolId" AND ev."registerId" = r."id"
          AND ev."eventType" = 'SUBMITTED'
      )
  ) THEN
    RAISE EXCEPTION 'Attendance entry requires exact currently active enrollment and open roster'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceEntry_validate"
BEFORE INSERT ON "AttendanceEntry"
FOR EACH ROW EXECUTE FUNCTION "validate_attendance_entry"();

-- The submission event must match the actual PRIMARY Form Teacher for this
-- class and session; reviewer event requires exact class section, verified
-- scope, and HM/Principal stage mapping. Platform status confers no privilege.
CREATE FUNCTION "validate_attendance_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NEW."eventType" = 'SUBMITTED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AttendanceRegister" r
      JOIN "School" s ON s."id" = r."schoolId" AND s."isActive" = true
      JOIN "AcademicSession" session ON session."id" = r."sessionId"
        AND session."schoolId" = r."schoolId" AND session."status" = 'ACTIVE'
      JOIN "SchoolClass" c ON c."id" = r."classId"
        AND c."schoolId" = r."schoolId" AND c."isActive" = true
      JOIN "SchoolSection" section ON section."id" = c."sectionId"
        AND section."schoolId" = c."schoolId" AND section."isActive" = true
      JOIN "FormTeacherResponsibility" f ON f."id" = r."formTeacherResponsibilityId"
        AND f."schoolId" = r."schoolId" AND f."membershipId" = r."submittedByMembershipId"
        AND f."classId" = r."classId" AND f."sessionId" = r."sessionId"
        AND f."status" = 'ACTIVE' AND f."kind" = 'PRIMARY'
      JOIN "Membership" m ON m."id" = f."membershipId" AND m."schoolId" = f."schoolId"
        AND m."role" IN ('TEACHER', 'FORM_TEACHER') AND m."isActive" = true
      WHERE r."id" = NEW."registerId" AND r."schoolId" = NEW."schoolId"
        AND r."status" = 'SUBMITTED'
        AND r."submittedByMembershipId" = NEW."actorMembershipId"
        AND m."userId" = NEW."actorUserId"
        AND r."attendanceDate" BETWEEN session."startsOn" AND session."endsOn"
        AND EXISTS (
          SELECT 1 FROM "AttendanceEntry" entry
          WHERE entry."schoolId" = r."schoolId" AND entry."registerId" = r."id"
        )
    ) THEN
      RAISE EXCEPTION 'Attendance submission requires owning active primary Form Teacher'
        USING ERRCODE = '23503';
    END IF;
  ELSIF NEW."eventType" IN ('APPROVED', 'RETURNED') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AttendanceRegister" r
      JOIN "School" s ON s."id" = r."schoolId" AND s."isActive" = true
      JOIN "SchoolClass" c ON c."id" = r."classId"
        AND c."schoolId" = r."schoolId" AND c."isActive" = true
      JOIN "SchoolSection" section ON section."id" = c."sectionId"
        AND section."schoolId" = c."schoolId" AND section."isActive" = true
      JOIN "Membership" reviewer ON reviewer."id" = NEW."actorMembershipId"
        AND reviewer."schoolId" = r."schoolId"
        AND reviewer."userId" = NEW."actorUserId" AND reviewer."isActive" = true
      JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
        AND grant."type" = 'SECTION' AND grant."scopeId" = section."id"
        AND grant."verified" = true
      WHERE r."id" = NEW."registerId" AND r."schoolId" = NEW."schoolId"
        AND r."status"::text = NEW."eventType"::text
        AND (
          (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
          OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
        )
    ) THEN
      RAISE EXCEPTION 'Attendance review needs exact verified school section authority'
        USING ERRCODE = '23503';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported attendance event' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceEvent_validate"
BEFORE INSERT ON "AttendanceEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_attendance_event_actor"();

-- Deferred at transaction commit: no new register or decision can be retained
-- without a matching append-only actor-validated event, including raw DB writes.
CREATE FUNCTION "require_attendance_events"() RETURNS trigger AS $$
DECLARE
  current_status "AttendanceRegisterStatus";
BEGIN
  SELECT "status" INTO current_status FROM "AttendanceRegister"
  WHERE "id" = NEW."id" AND "schoolId" = NEW."schoolId";
  IF current_status IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "AttendanceEvent"
    WHERE "schoolId" = NEW."schoolId" AND "registerId" = NEW."id"
      AND "eventType" = 'SUBMITTED'
  ) OR NOT EXISTS (
    SELECT 1 FROM "AttendanceEntry"
    WHERE "schoolId" = NEW."schoolId" AND "registerId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Attendance requires immutable entries and submission audit'
      USING ERRCODE = '23514';
  END IF;
  IF current_status = 'APPROVED' AND NOT EXISTS (
    SELECT 1 FROM "AttendanceEvent"
    WHERE "schoolId" = NEW."schoolId" AND "registerId" = NEW."id"
      AND "eventType" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Approved attendance requires decision audit'
      USING ERRCODE = '23514';
  ELSIF current_status = 'RETURNED' AND NOT EXISTS (
    SELECT 1 FROM "AttendanceEvent"
    WHERE "schoolId" = NEW."schoolId" AND "registerId" = NEW."id"
      AND "eventType" = 'RETURNED'
  ) THEN
    RAISE EXCEPTION 'Returned attendance requires decision audit'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "AttendanceRegister_require_events"
AFTER INSERT OR UPDATE ON "AttendanceRegister"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "require_attendance_events"();

-- Retain history, including direct SQL, while preserving the existing
-- deliberately explicit tenant deletion cascade convention.
CREATE FUNCTION "prevent_attendance_history_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Attendance history is append-only' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceRegister_immutable_delete"
BEFORE DELETE ON "AttendanceRegister"
FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "AttendanceEntry_immutable"
BEFORE UPDATE OR DELETE ON "AttendanceEntry"
FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "AttendanceEvent_immutable"
BEFORE UPDATE OR DELETE ON "AttendanceEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();

CREATE FUNCTION "prevent_attendance_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Attendance history cannot be truncated' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceRegister_no_truncate"
BEFORE TRUNCATE ON "AttendanceRegister"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "AttendanceEntry_no_truncate"
BEFORE TRUNCATE ON "AttendanceEntry"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "AttendanceEvent_no_truncate"
BEFORE TRUNCATE ON "AttendanceEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

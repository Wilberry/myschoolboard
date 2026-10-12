-- Phase 5: tenant-owned timetable slots with database-enforced overlaps.
-- btree_gist is a standard PostgreSQL extension required for scalar key
-- equality alongside int4range overlap exclusions. Check its availability
-- on the disposable test/target database before any real rollout.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "TimetableSlotStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "TimetableEventType" AS ENUM ('CREATED', 'CANCELLED');
ALTER TYPE "SchoolConfigurationEventType" ADD VALUE 'TIMETABLE_ROOM_CREATED';

-- The session is an explicit part of a valid assignment/term identity.
-- No existing assignment data is rewritten.
CREATE UNIQUE INDEX "TeacherAssignment_schedule_identity"
ON "TeacherClassSubjectAssignment"
("schoolId", "id", "membershipId", "classId", "sessionId");
CREATE UNIQUE INDEX "AcademicTerm_schoolId_sessionId_id_key"
ON "AcademicTerm"("schoolId", "sessionId", "id");

CREATE TABLE "TimetableRoom" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableRoom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimetableRoom_schoolId_id_key"
ON "TimetableRoom"("schoolId", "id");
CREATE UNIQUE INDEX "TimetableRoom_schoolId_name_key"
ON "TimetableRoom"("schoolId", "name");
ALTER TABLE "TimetableRoom"
ADD CONSTRAINT "TimetableRoom_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TimetableSlot" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "roomId" TEXT,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "status" "TimetableSlotStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimetableSlot_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  CONSTRAINT "TimetableSlot_time_check" CHECK (
    "startMinute" >= 0 AND
    "endMinute" <= 1440 AND
    "startMinute" < "endMinute"
  )
);
CREATE UNIQUE INDEX "TimetableSlot_schoolId_id_key"
ON "TimetableSlot"("schoolId", "id");
CREATE INDEX "TimetableSlot_schoolId_termId_weekday_startMinute_idx"
ON "TimetableSlot"("schoolId", "termId", "weekday", "startMinute");
CREATE INDEX "TimetableSlot_schoolId_assignmentId_status_idx"
ON "TimetableSlot"("schoolId", "assignmentId", "status");

ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId")
REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_sessionId_termId_fkey"
FOREIGN KEY ("schoolId", "sessionId", "termId")
REFERENCES "AcademicTerm"("schoolId", "sessionId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_school_assignment_fkey"
FOREIGN KEY ("schoolId", "assignmentId", "membershipId", "classId", "sessionId")
REFERENCES "TeacherClassSubjectAssignment"
("schoolId", "id", "membershipId", "classId", "sessionId")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_membershipId_fkey"
FOREIGN KEY ("schoolId", "membershipId")
REFERENCES "Membership"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_classId_fkey"
FOREIGN KEY ("schoolId", "classId")
REFERENCES "SchoolClass"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_schoolId_roomId_fkey"
FOREIGN KEY ("schoolId", "roomId")
REFERENCES "TimetableRoom"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- PostgreSQL exclusion constraints are the final concurrency-safe barrier.
-- Endpoints are half-open [start, end), so adjacent periods are legal.
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_teacher_no_overlap"
EXCLUDE USING gist (
  "schoolId" WITH =, "termId" WITH =,
  "weekday" WITH =, "membershipId" WITH =,
  int4range("startMinute", "endMinute", '[)') WITH &&
) WHERE ("status" = 'ACTIVE');
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_class_no_overlap"
EXCLUDE USING gist (
  "schoolId" WITH =, "termId" WITH =,
  "weekday" WITH =, "classId" WITH =,
  int4range("startMinute", "endMinute", '[)') WITH &&
) WHERE ("status" = 'ACTIVE');
ALTER TABLE "TimetableSlot"
ADD CONSTRAINT "TimetableSlot_room_no_overlap"
EXCLUDE USING gist (
  "schoolId" WITH =, "termId" WITH =,
  "weekday" WITH =, "roomId" WITH =,
  int4range("startMinute", "endMinute", '[)') WITH &&
) WHERE ("status" = 'ACTIVE' AND "roomId" IS NOT NULL);

CREATE TABLE "TimetableEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "TimetableEventType" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimetableEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimetableEvent_schoolId_slotId_createdAt_idx"
ON "TimetableEvent"("schoolId", "slotId", "createdAt");
CREATE INDEX "TimetableEvent_schoolId_actorUserId_createdAt_idx"
ON "TimetableEvent"("schoolId", "actorUserId", "createdAt");
ALTER TABLE "TimetableEvent"
ADD CONSTRAINT "TimetableEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableEvent"
ADD CONSTRAINT "TimetableEvent_schoolId_slotId_fkey"
FOREIGN KEY ("schoolId", "slotId")
REFERENCES "TimetableSlot"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_timetable_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "id" = NEW."actorMembershipId"
      AND "userId" = NEW."actorUserId"
      AND "schoolId" = NEW."schoolId"
      AND "isActive" = true
      AND "role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Timetable event actor must be an active school admin'
    USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TimetableEvent_validate_actor"
BEFORE INSERT ON "TimetableEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_timetable_event_actor"();

CREATE FUNCTION "prevent_timetable_event_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Timetable history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TimetableEvent_immutable"
BEFORE UPDATE OR DELETE ON "TimetableEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_timetable_event_mutation"();
CREATE FUNCTION "prevent_timetable_event_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Timetable history cannot be truncated';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TimetableEvent_no_truncate"
BEFORE TRUNCATE ON "TimetableEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_timetable_event_truncate"();

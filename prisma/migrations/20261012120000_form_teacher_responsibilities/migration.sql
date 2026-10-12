-- Additive Form Teacher responsibility model, scoped to the owning school,
-- class and academic session. Existing subject-teacher assignments stay intact.
CREATE TYPE "FormTeacherKind" AS ENUM ('PRIMARY', 'SUPPORT');
CREATE TYPE "FormTeacherStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "FormTeacherEventType" AS ENUM (
  'ASSIGNED', 'HANDOVER_OUT', 'HANDOVER_IN', 'ENDED'
);
ALTER TABLE "School"
ADD COLUMN "allowCoFormTeachers" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FormTeacherResponsibility" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "kind" "FormTeacherKind" NOT NULL DEFAULT 'PRIMARY',
  "status" "FormTeacherStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "FormTeacherResponsibility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FormTeacherResponsibility_schoolId_id_membershipId_key"
ON "FormTeacherResponsibility"("schoolId", "id", "membershipId");
CREATE UNIQUE INDEX "FormTeacherResponsibility_schoolId_id_key"
ON "FormTeacherResponsibility"("schoolId", "id");
CREATE INDEX "FormTeacherResponsibility_schoolId_sessionId_classId_status_idx"
ON "FormTeacherResponsibility"("schoolId", "sessionId", "classId", "status");
CREATE INDEX "FormTeacherResponsibility_schoolId_membershipId_status_idx"
ON "FormTeacherResponsibility"("schoolId", "membershipId", "status");

-- Exactly one active primary Form Teacher per class and session.
-- SUPPORT co-responsibilities are permitted only by school policy in the
-- service; a membership cannot simultaneously have both kinds for a class.
CREATE UNIQUE INDEX "FormTeacher_one_active_primary"
ON "FormTeacherResponsibility"("schoolId", "sessionId", "classId")
WHERE "kind" = 'PRIMARY' AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "FormTeacher_one_active_membership"
ON "FormTeacherResponsibility"("schoolId", "sessionId", "classId", "membershipId")
WHERE "status" = 'ACTIVE';

ALTER TABLE "FormTeacherResponsibility"
ADD CONSTRAINT "FormTeacherResponsibility_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormTeacherResponsibility"
ADD CONSTRAINT "FormTeacherResponsibility_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId") REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FormTeacherResponsibility"
ADD CONSTRAINT "FormTeacherResponsibility_schoolId_classId_fkey"
FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FormTeacherResponsibility"
ADD CONSTRAINT "FormTeacherResponsibility_schoolId_membershipId_fkey"
FOREIGN KEY ("schoolId", "membershipId") REFERENCES "Membership"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "FormTeacherEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "responsibilityId" TEXT NOT NULL,
  "teacherMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "FormTeacherEventType" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormTeacherEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FormTeacherEvent_schoolId_responsibilityId_createdAt_idx"
ON "FormTeacherEvent"("schoolId", "responsibilityId", "createdAt");
CREATE INDEX "FormTeacherEvent_schoolId_actorUserId_createdAt_idx"
ON "FormTeacherEvent"("schoolId", "actorUserId", "createdAt");

ALTER TABLE "FormTeacherEvent"
ADD CONSTRAINT "FormTeacherEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormTeacherEvent"
ADD CONSTRAINT "FormTeacherEvent_responsibility_fkey"
FOREIGN KEY ("schoolId", "responsibilityId", "teacherMembershipId")
REFERENCES "FormTeacherResponsibility"("schoolId", "id", "membershipId")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_form_teacher_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "id" = NEW."actorMembershipId"
      AND "userId" = NEW."actorUserId"
      AND "schoolId" = NEW."schoolId"
      AND "isActive" = true
      AND "role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Form Teacher audit actor must be a school admin'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FormTeacherEvent_validate_actor"
BEFORE INSERT ON "FormTeacherEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_form_teacher_actor"();

CREATE FUNCTION "prevent_form_teacher_event_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Form Teacher history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FormTeacherEvent_immutable"
BEFORE UPDATE OR DELETE ON "FormTeacherEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_form_teacher_event_mutation"();

CREATE FUNCTION "prevent_form_teacher_event_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Form Teacher history cannot be truncated';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FormTeacherEvent_no_truncate"
BEFORE TRUNCATE ON "FormTeacherEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_form_teacher_event_truncate"();

-- Auditable school-level co-responsibility configuration.
ALTER TYPE "SchoolConfigurationEventType"
ADD VALUE 'FORM_TEACHER_POLICY_CHANGED';

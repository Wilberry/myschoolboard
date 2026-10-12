-- Additive academic period structure. No teacher-assignment row is backfilled.
CREATE TYPE "AcademicPeriodStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

CREATE TABLE "AcademicSession" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicSession_dates_check" CHECK ("startsOn" < "endsOn")
);

CREATE UNIQUE INDEX "AcademicSession_schoolId_id_key"
ON "AcademicSession"("schoolId", "id");
CREATE UNIQUE INDEX "AcademicSession_schoolId_name_key"
ON "AcademicSession"("schoolId", "name");
CREATE INDEX "AcademicSession_schoolId_status_idx"
ON "AcademicSession"("schoolId", "status");
CREATE UNIQUE INDEX "AcademicSession_one_active_per_school"
ON "AcademicSession"("schoolId") WHERE "status" = 'ACTIVE';

ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AcademicTerm" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicTerm_dates_check" CHECK ("startsOn" < "endsOn"),
  CONSTRAINT "AcademicTerm_position_check" CHECK ("position" BETWEEN 1 AND 8)
);
CREATE UNIQUE INDEX "AcademicTerm_schoolId_id_key"
ON "AcademicTerm"("schoolId", "id");
CREATE UNIQUE INDEX "AcademicTerm_schoolId_sessionId_name_key"
ON "AcademicTerm"("schoolId", "sessionId", "name");
CREATE UNIQUE INDEX "AcademicTerm_schoolId_sessionId_position_key"
ON "AcademicTerm"("schoolId", "sessionId", "position");
CREATE INDEX "AcademicTerm_schoolId_sessionId_status_idx"
ON "AcademicTerm"("schoolId", "sessionId", "status");
CREATE UNIQUE INDEX "AcademicTerm_one_active_per_session"
ON "AcademicTerm"("schoolId", "sessionId") WHERE "status" = 'ACTIVE';

ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId") REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- Date containment is also checked in the serialized application service.
-- The parent session must be locked before a new term is created.

-- Tenant-owned configuration changes are recorded in the same transaction
-- as each create operation. Actor IDs are historical text snapshots.
CREATE TYPE "SchoolConfigurationEventType" AS ENUM (
  'ACADEMIC_SESSION_CREATED',
  'ACADEMIC_TERM_CREATED',
  'CLASS_CREATED',
  'SUBJECT_CREATED'
);
CREATE TABLE "SchoolConfigurationEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "SchoolConfigurationEventType" NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolConfigurationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchoolConfigurationEvent_schoolId_createdAt_idx"
ON "SchoolConfigurationEvent"("schoolId", "createdAt");
CREATE INDEX "SchoolConfigurationEvent_schoolId_eventType_createdAt_idx"
ON "SchoolConfigurationEvent"("schoolId", "eventType", "createdAt");

ALTER TABLE "SchoolConfigurationEvent"
ADD CONSTRAINT "SchoolConfigurationEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "validate_school_configuration_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "id" = NEW."actorMembershipId"
      AND "userId" = NEW."actorUserId"
      AND "schoolId" = NEW."schoolId"
      AND "isActive" = true
      AND "role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'School configuration event actor must be an active school admin'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SchoolConfigurationEvent_validate_actor"
BEFORE INSERT ON "SchoolConfigurationEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_school_configuration_event_actor"();

CREATE FUNCTION "prevent_school_configuration_event_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'School configuration events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SchoolConfigurationEvent_immutable"
BEFORE UPDATE OR DELETE ON "SchoolConfigurationEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_school_configuration_event_mutation"();

CREATE FUNCTION "prevent_school_configuration_event_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'School configuration events cannot be truncated';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SchoolConfigurationEvent_no_truncate"
BEFORE TRUNCATE ON "SchoolConfigurationEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_school_configuration_event_truncate"();

-- Student/admissions history: additive, school-owned, no historical mapping.
-- This migration does not attach existing User rows to StudentRecord.
CREATE TYPE "StudentLifecycleStatus" AS ENUM (
  'REGISTERED', 'ENROLLED', 'WITHDRAWN'
);
CREATE TYPE "StudentEnrollmentStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "StudentEventType" AS ENUM (
  'REGISTERED', 'ENROLLED', 'WITHDRAWN'
);

CREATE TABLE "StudentRecord" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "admissionNumber" TEXT NOT NULL,
  "givenName" TEXT NOT NULL,
  "familyName" TEXT NOT NULL,
  "status" "StudentLifecycleStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentRecord_schoolId_id_key"
ON "StudentRecord"("schoolId", "id");
CREATE UNIQUE INDEX "StudentRecord_schoolId_admissionNumber_key"
ON "StudentRecord"("schoolId", "admissionNumber");
CREATE INDEX "StudentRecord_schoolId_status_idx"
ON "StudentRecord"("schoolId", "status");
ALTER TABLE "StudentRecord"
ADD CONSTRAINT "StudentRecord_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentEnrollment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "status" "StudentEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEnrollment_status_ended_check" CHECK (
    ("status" = 'ACTIVE' AND "endedAt" IS NULL)
    OR ("status" = 'ENDED' AND "endedAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "StudentEnrollment_schoolId_id_key"
ON "StudentEnrollment"("schoolId", "id");
CREATE UNIQUE INDEX "StudentEnrollment_schoolId_id_studentId_key"
ON "StudentEnrollment"("schoolId", "id", "studentId");
CREATE INDEX "StudentEnrollment_schoolId_studentId_sessionId_status_idx"
ON "StudentEnrollment"("schoolId", "studentId", "sessionId", "status");
CREATE INDEX "StudentEnrollment_schoolId_classId_sessionId_status_idx"
ON "StudentEnrollment"("schoolId", "classId", "sessionId", "status");
CREATE UNIQUE INDEX "StudentEnrollment_one_active_per_student_session"
ON "StudentEnrollment"("schoolId", "studentId", "sessionId")
WHERE "status" = 'ACTIVE';

ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_schoolId_studentId_fkey"
FOREIGN KEY ("schoolId", "studentId")
REFERENCES "StudentRecord"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId")
REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_schoolId_classId_fkey"
FOREIGN KEY ("schoolId", "classId")
REFERENCES "SchoolClass"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "StudentEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "StudentEventType" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEvent_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 5 AND 500
  ),
  CONSTRAINT "StudentEvent_enrollment_event_check" CHECK (
    ("eventType" = 'REGISTERED' AND "enrollmentId" IS NULL)
    OR ("eventType" IN ('ENROLLED', 'WITHDRAWN') AND "enrollmentId" IS NOT NULL)
  )
);
CREATE INDEX "StudentEvent_schoolId_studentId_createdAt_idx"
ON "StudentEvent"("schoolId", "studentId", "createdAt");
CREATE INDEX "StudentEvent_schoolId_actorUserId_createdAt_idx"
ON "StudentEvent"("schoolId", "actorUserId", "createdAt");
ALTER TABLE "StudentEvent"
ADD CONSTRAINT "StudentEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEvent"
ADD CONSTRAINT "StudentEvent_schoolId_studentId_fkey"
FOREIGN KEY ("schoolId", "studentId")
REFERENCES "StudentRecord"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentEvent"
ADD CONSTRAINT "StudentEvent_exact_enrollment_fkey"
FOREIGN KEY ("schoolId", "enrollmentId", "studentId")
REFERENCES "StudentEnrollment"("schoolId", "id", "studentId")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_student_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    JOIN "School" school ON school."id" = actor."schoolId"
    WHERE actor."id" = NEW."actorMembershipId"
      AND actor."userId" = NEW."actorUserId"
      AND actor."schoolId" = NEW."schoolId"
      AND actor."isActive" = true
      AND school."isActive" = true
      AND actor."role" IN ('SCHOOL_SUPER_ADMIN', 'SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Student event must have active school administrator actor'
      USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "StudentRecord" student
    LEFT JOIN "StudentEnrollment" enrollment
      ON enrollment."id" = NEW."enrollmentId"
     AND enrollment."schoolId" = NEW."schoolId"
     AND enrollment."studentId" = student."id"
    WHERE student."id" = NEW."studentId"
      AND student."schoolId" = NEW."schoolId"
      AND (
        (NEW."eventType" = 'REGISTERED'
         AND NEW."enrollmentId" IS NULL
         AND student."status" = 'REGISTERED')
        OR (NEW."eventType" = 'ENROLLED'
            AND enrollment."status" = 'ACTIVE'
            AND student."status" = 'ENROLLED')
        OR (NEW."eventType" = 'WITHDRAWN'
            AND enrollment."status" = 'ENDED'
            AND student."status" = 'WITHDRAWN')
      )
  ) THEN
    RAISE EXCEPTION 'Student event state and target do not match'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentEvent_validate_actor"
BEFORE INSERT ON "StudentEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_student_event_actor"();

CREATE FUNCTION "prevent_student_event_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Student enrollment history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentEvent_immutable"
BEFORE UPDATE OR DELETE ON "StudentEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_student_event_mutation"();

CREATE FUNCTION "prevent_student_event_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Student enrollment history cannot be truncated';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentEvent_no_truncate"
BEFORE TRUNCATE ON "StudentEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_student_event_truncate"();

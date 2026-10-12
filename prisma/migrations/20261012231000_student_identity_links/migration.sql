-- Additive explicit, school-administrator verified student-account binding.
-- No links are inferred, backfilled or automatically created from existing users.
CREATE TYPE "StudentIdentityLinkEventType" AS ENUM ('LINKED','REVOKED');
CREATE TABLE "StudentIdentityLinkEvent" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" "StudentIdentityLinkEventType" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" TEXT NOT NULL, "actorMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentIdentityLinkEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentIdentityLinkEvent_reason_check" CHECK (
    "sequence" > 0 AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "StudentIdentityLinkEvent_schoolId_membershipId_sequence_key"
  ON "StudentIdentityLinkEvent"("schoolId","membershipId","sequence");
CREATE INDEX "StudentIdentityLinkEvent_schoolId_studentId_createdAt_idx"
  ON "StudentIdentityLinkEvent"("schoolId","studentId","createdAt");
ALTER TABLE "StudentIdentityLinkEvent" ADD CONSTRAINT "StudentIdentityLinkEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentIdentityLinkEvent" ADD CONSTRAINT "StudentIdentityLinkEvent_subject_fkey"
  FOREIGN KEY ("schoolId","membershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentIdentityLinkEvent" ADD CONSTRAINT "StudentIdentityLinkEvent_student_fkey"
  FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentIdentityLinkEvent" ADD CONSTRAINT "StudentIdentityLinkEvent_verifier_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_student_identity_link_event"() RETURNS trigger AS $$
DECLARE
  prior_student TEXT;
  prior_type "StudentIdentityLinkEventType";
  next_sequence INTEGER;
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id" = NEW."schoolId" AND school."isActive" = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for identity verification' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    WHERE actor."id" = NEW."actorMembershipId"
      AND actor."schoolId" = NEW."schoolId"
      AND actor."userId" = NEW."actorUserId"
      AND actor."isActive" = true
      AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
  ) OR NOT EXISTS (
    SELECT 1 FROM "Membership" student_member
    WHERE student_member."id" = NEW."membershipId"
      AND student_member."schoolId" = NEW."schoolId"
      AND student_member."isActive" = true
      AND student_member."role" = 'STUDENT'
  ) THEN
    RAISE EXCEPTION 'Verified school administrator and active STUDENT membership required'
      USING ERRCODE='23503';
  END IF;

  SELECT prior."studentId", prior."eventType", prior."sequence" + 1
    INTO prior_student, prior_type, next_sequence
    FROM "StudentIdentityLinkEvent" prior
    WHERE prior."schoolId" = NEW."schoolId"
      AND prior."membershipId" = NEW."membershipId"
    ORDER BY prior."sequence" DESC LIMIT 1;
  next_sequence := COALESCE(next_sequence, 1);
  IF NEW."sequence" <> next_sequence THEN
    RAISE EXCEPTION 'Identity link sequence mismatch' USING ERRCODE='23514';
  END IF;

  IF NEW."eventType" = 'LINKED' THEN
    IF prior_type = 'LINKED' OR NOT EXISTS (
      SELECT 1 FROM "StudentRecord" pupil
      WHERE pupil."id" = NEW."studentId"
        AND pupil."schoolId" = NEW."schoolId"
        AND pupil."status" = 'ENROLLED'
    ) OR EXISTS (
      SELECT 1 FROM "Membership" other
      JOIN LATERAL (
        SELECT latest."studentId", latest."eventType"
        FROM "StudentIdentityLinkEvent" latest
        WHERE latest."schoolId" = other."schoolId"
          AND latest."membershipId" = other."id"
        ORDER BY latest."sequence" DESC LIMIT 1
      ) link ON true
      WHERE other."schoolId" = NEW."schoolId"
        AND other."id" <> NEW."membershipId"
        AND link."studentId" = NEW."studentId"
        AND link."eventType" = 'LINKED'
    ) THEN
      RAISE EXCEPTION 'Student identity is already linked or ineligible'
        USING ERRCODE='23514';
    END IF;
  ELSIF NEW."eventType" = 'REVOKED' THEN
    IF prior_type IS DISTINCT FROM 'LINKED' OR prior_student <> NEW."studentId" THEN
      RAISE EXCEPTION 'Revoke only an existing exact verified student link'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentIdentityLinkEvent_validate"
  BEFORE INSERT ON "StudentIdentityLinkEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_student_identity_link_event"();
CREATE TRIGGER "StudentIdentityLinkEvent_immutable"
  BEFORE UPDATE OR DELETE ON "StudentIdentityLinkEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "StudentIdentityLinkEvent_no_truncate"
  BEFORE TRUNCATE ON "StudentIdentityLinkEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

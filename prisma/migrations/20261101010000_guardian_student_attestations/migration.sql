-- Issue #20: explicit same-school guardian/student attestation only.
-- No backfill, no email/name matching, no guardian-facing reads or publication.
CREATE TABLE "GuardianStudentLink" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "guardianMembershipId" TEXT NOT NULL,
  "attestedByMembershipId" TEXT NOT NULL, "attestedByUserId" TEXT NOT NULL,
  "attestationReason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianStudentLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuardianStudentLink_attestation_reason_check"
    CHECK (char_length(btrim("attestationReason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "GuardianStudentLink_schoolId_id_key"
  ON "GuardianStudentLink"("schoolId", "id");
CREATE UNIQUE INDEX "GuardianStudentLink_schoolId_studentId_guardianMembershipId_key"
  ON "GuardianStudentLink"("schoolId", "studentId", "guardianMembershipId");
CREATE INDEX "GuardianStudentLink_schoolId_guardianMembershipId_idx"
  ON "GuardianStudentLink"("schoolId", "guardianMembershipId");
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_student_fkey"
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "StudentRecord"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_guardian_fkey"
  FOREIGN KEY ("schoolId", "guardianMembershipId") REFERENCES "Membership"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_attestor_fkey"
  FOREIGN KEY ("schoolId", "attestedByMembershipId") REFERENCES "Membership"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "GuardianStudentLinkRevocation" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "linkId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianStudentLinkRevocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuardianStudentLinkRevocation_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "GuardianStudentLinkRevocation_schoolId_linkId_key"
  ON "GuardianStudentLinkRevocation"("schoolId", "linkId");
ALTER TABLE "GuardianStudentLinkRevocation" ADD CONSTRAINT "GuardianStudentLinkRevocation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLinkRevocation" ADD CONSTRAINT "GuardianStudentLinkRevocation_link_fkey"
  FOREIGN KEY ("schoolId", "linkId") REFERENCES "GuardianStudentLink"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLinkRevocation" ADD CONSTRAINT "GuardianStudentLinkRevocation_actor_fkey"
  FOREIGN KEY ("schoolId", "actorMembershipId") REFERENCES "Membership"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Database-side validation also protects against direct ORM bypass.
CREATE FUNCTION "validate_guardian_student_binding"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardian link requires active school' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" administrator
    WHERE administrator."schoolId"=NEW."schoolId"
      AND administrator."id"=NEW."attestedByMembershipId"
      AND administrator."userId"=NEW."attestedByUserId"
      AND administrator."isActive"=true
      AND administrator."role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
  ) OR NOT EXISTS (
    SELECT 1 FROM "Membership" guardian
    WHERE guardian."schoolId"=NEW."schoolId"
      AND guardian."id"=NEW."guardianMembershipId"
      AND guardian."role"='PARENT' AND guardian."isActive"=true
  ) OR NOT EXISTS (
    SELECT 1 FROM "StudentRecord" student
    WHERE student."schoolId"=NEW."schoolId" AND student."id"=NEW."studentId"
      AND student."status"='ENROLLED'
      AND EXISTS (
        SELECT 1 FROM "StudentEnrollment" e
        JOIN "AcademicSession" ses ON ses."schoolId"=e."schoolId" AND ses."id"=e."sessionId"
        JOIN "SchoolClass" cls ON cls."schoolId"=e."schoolId" AND cls."id"=e."classId"
        JOIN "SchoolSection" sec ON sec."schoolId"=cls."schoolId" AND sec."id"=cls."sectionId"
        WHERE e."schoolId"=NEW."schoolId" AND e."studentId"=student."id"
          AND e."status"='ACTIVE' AND ses."status"='ACTIVE'
          AND cls."isActive"=true AND sec."isActive"=true
      )
  ) THEN
    RAISE EXCEPTION 'Guardian link requires active parent, enrolled pupil and admin attestation'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GuardianStudentLink_validate"
  BEFORE INSERT ON "GuardianStudentLink"
  FOR EACH ROW EXECUTE FUNCTION "validate_guardian_student_binding"();

CREATE FUNCTION "validate_guardian_link_revocation"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revocation requires active school' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    JOIN "GuardianStudentLink" link ON link."schoolId"=actor."schoolId"
    WHERE actor."schoolId"=NEW."schoolId"
      AND actor."id"=NEW."actorMembershipId"
      AND actor."userId"=NEW."actorUserId"
      AND actor."isActive"=true
      AND actor."role" IN ('SCHOOL_ADMIN', 'SCHOOL_SUPER_ADMIN')
      AND link."id"=NEW."linkId"
  ) THEN
    RAISE EXCEPTION 'Guardian link revocation requires same-school administrator'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GuardianStudentLinkRevocation_validate"
  BEFORE INSERT ON "GuardianStudentLinkRevocation"
  FOR EACH ROW EXECUTE FUNCTION "validate_guardian_link_revocation"();

-- Append-only attestation and terminal revocation; school lifecycle remains explicit.
CREATE TRIGGER "GuardianStudentLink_immutable"
  BEFORE UPDATE OR DELETE ON "GuardianStudentLink"
  FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "GuardianStudentLinkRevocation_immutable"
  BEFORE UPDATE OR DELETE ON "GuardianStudentLinkRevocation"
  FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "GuardianStudentLink_no_truncate"
  BEFORE TRUNCATE ON "GuardianStudentLink"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "GuardianStudentLinkRevocation_no_truncate"
  BEFORE TRUNCATE ON "GuardianStudentLinkRevocation"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

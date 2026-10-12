-- Phase 6 explicit identity binding, additive; NO automatic linking/backfill.
-- Administrative attestation must name an already active STUDENT membership and
-- exact enrolled StudentRecord, never infer from email/name/admission number.
CREATE TABLE "StudentAccountLink" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "attestedByMembershipId" TEXT NOT NULL, "attestedByUserId" TEXT NOT NULL,
  "attestationReason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAccountLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentAccountLink_reason_check"
    CHECK (char_length(btrim("attestationReason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "StudentAccountLink_schoolId_id_key"
 ON "StudentAccountLink"("schoolId","id");
CREATE UNIQUE INDEX "StudentAccountLink_schoolId_studentId_key"
 ON "StudentAccountLink"("schoolId","studentId");
CREATE UNIQUE INDEX "StudentAccountLink_schoolId_studentMembershipId_key"
 ON "StudentAccountLink"("schoolId","studentMembershipId");
ALTER TABLE "StudentAccountLink" ADD CONSTRAINT "StudentAccountLink_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAccountLink" ADD CONSTRAINT "StudentAccountLink_student_fkey"
 FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentAccountLink" ADD CONSTRAINT "StudentAccountLink_student_member_fkey"
 FOREIGN KEY ("schoolId","studentMembershipId") REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentAccountLink" ADD CONSTRAINT "StudentAccountLink_attestor_fkey"
 FOREIGN KEY ("schoolId","attestedByMembershipId") REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "StudentAccountLinkRevocation" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "linkId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAccountLinkRevocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentAccountLinkRevocation_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "StudentAccountLinkRevocation_schoolId_linkId_key"
 ON "StudentAccountLinkRevocation"("schoolId","linkId");
ALTER TABLE "StudentAccountLinkRevocation" ADD CONSTRAINT "StudentAccountLinkRevocation_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAccountLinkRevocation" ADD CONSTRAINT "StudentAccountLinkRevocation_link_fkey"
 FOREIGN KEY ("schoolId","linkId") REFERENCES "StudentAccountLink"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "StudentAccountLinkRevocation" ADD CONSTRAINT "StudentAccountLinkRevocation_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_student_account_binding"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for identity binding' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" administrator
    WHERE administrator."id"=NEW."attestedByMembershipId"
      AND administrator."schoolId"=NEW."schoolId"
      AND administrator."userId"=NEW."attestedByUserId"
      AND administrator."isActive"=true
      AND administrator."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
  ) OR NOT EXISTS (
    SELECT 1 FROM "Membership" pupil
    JOIN "StudentRecord" student ON student."id"=NEW."studentId"
      AND student."schoolId"=pupil."schoolId" AND student."status"='ENROLLED'
    WHERE pupil."id"=NEW."studentMembershipId"
      AND pupil."schoolId"=NEW."schoolId"
      AND pupil."role"='STUDENT' AND pupil."isActive"=true
      AND EXISTS (
        SELECT 1 FROM "StudentEnrollment" e
        WHERE e."schoolId"=NEW."schoolId" AND e."studentId"=student."id"
          AND e."status"='ACTIVE'
      )
  ) THEN
    RAISE EXCEPTION 'Identity binding needs enrolled pupil, STUDENT member and admin attestation'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentAccountLink_validate"
 BEFORE INSERT ON "StudentAccountLink"
 FOR EACH ROW EXECUTE FUNCTION "validate_student_account_binding"();

CREATE FUNCTION "validate_student_link_revocation"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    JOIN "StudentAccountLink" link ON link."schoolId"=actor."schoolId"
    WHERE actor."id"=NEW."actorMembershipId"
      AND actor."schoolId"=NEW."schoolId"
      AND actor."userId"=NEW."actorUserId"
      AND actor."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
      AND actor."isActive"=true
      AND link."id"=NEW."linkId"
  ) THEN
    RAISE EXCEPTION 'Revocation requires same-school active administrator'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StudentAccountLinkRevocation_validate"
 BEFORE INSERT ON "StudentAccountLinkRevocation"
 FOR EACH ROW EXECUTE FUNCTION "validate_student_link_revocation"();

-- School lifecycle retains existing explicit cascade; direct mutations denied.
CREATE TRIGGER "StudentAccountLink_immutable"
 BEFORE UPDATE OR DELETE ON "StudentAccountLink"
 FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "StudentAccountLinkRevocation_immutable"
 BEFORE UPDATE OR DELETE ON "StudentAccountLinkRevocation"
 FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "StudentAccountLink_no_truncate"
 BEFORE TRUNCATE ON "StudentAccountLink"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "StudentAccountLinkRevocation_no_truncate"
 BEFORE TRUNCATE ON "StudentAccountLinkRevocation"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

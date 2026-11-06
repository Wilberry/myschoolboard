-- Optional private raster evidence is NEVER automatic bank verification.
CREATE TABLE "PaymentEvidenceAttachment" (
 "id" TEXT PRIMARY KEY,
 "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
 "evidenceId" TEXT NOT NULL,
 "requestKey" UUID NOT NULL,
 "sha256" VARCHAR(64) NOT NULL CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
 "mediaType" VARCHAR(32) NOT NULL CHECK ("mediaType"='image/png'),
 "sizeBytes" INTEGER NOT NULL CHECK ("sizeBytes">0 AND "sizeBytes"<=10485760),
 "width" INTEGER NOT NULL CHECK ("width">0 AND "width"<=4096),
 "height" INTEGER NOT NULL CHECK ("height">0 AND "height"<=4096),
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","id"), UNIQUE ("schoolId","requestKey"), UNIQUE ("schoolId","evidenceId","sha256"),
 FOREIGN KEY ("schoolId","evidenceId") REFERENCES "PaymentEvidence"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);
CREATE FUNCTION "validate_payment_evidence_attachment"() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive" FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (
  SELECT 1 FROM "PaymentEvidence" e JOIN "Membership" m ON m."schoolId"=e."schoolId"
   AND m."id"=NEW."actorMembershipId" AND m."userId"=NEW."actorUserId"
   AND m."role"='SCHOOL_ADMIN' AND m."isActive"
  WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."evidenceId"
   AND e."submitterMembershipId"=m."id" AND e."submitterUserId"=m."userId"
   AND NOT EXISTS (SELECT 1 FROM "PaymentVerificationDecision" d
     WHERE d."schoolId"=e."schoolId" AND d."evidenceId"=e."id")
 ) THEN
  RAISE EXCEPTION 'Current original submitter and pending evidence required' USING ERRCODE='23503';
 END IF;
 NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PaymentEvidenceAttachment_validate" BEFORE INSERT ON "PaymentEvidenceAttachment"
 FOR EACH ROW EXECUTE FUNCTION "validate_payment_evidence_attachment"();
CREATE TRIGGER "PaymentEvidenceAttachment_immutable" BEFORE UPDATE OR DELETE ON "PaymentEvidenceAttachment"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PaymentEvidenceAttachment_no_truncate" BEFORE TRUNCATE ON "PaymentEvidenceAttachment"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Phase 9: distinct transfer-REFERENCE claims and independent manual review.
-- No file upload, provider callback, actual funds processing, receipt or refund.
-- Both tables are immutable and use exactly scoped school FKs.
CREATE TYPE "PaymentEvidenceStatus" AS ENUM ('SUBMITTED');
CREATE TYPE "PaymentVerificationAction" AS ENUM ('VERIFIED','REJECTED');

CREATE TABLE "PaymentEvidence" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "referenceDigest" VARCHAR(64) NOT NULL,
  "claimedAmountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "PaymentEvidenceStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reason" VARCHAR(500) NOT NULL,
  "submitterMembershipId" TEXT NOT NULL,
  "submitterUserId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentEvidence_values_check" CHECK (
    "claimedAmountMinor">0 AND "claimedAmountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "referenceDigest" ~ '^[a-f0-9]{64}$'
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    AND "reason"=btrim("reason")
    AND char_length(btrim("reason")) BETWEEN 5 AND 500
    AND "status"='SUBMITTED'
  )
);
CREATE UNIQUE INDEX "PaymentEvidence_schoolId_id_key"
  ON "PaymentEvidence"("schoolId","id");
CREATE UNIQUE INDEX "PaymentEvidence_schoolId_requestKey_key"
  ON "PaymentEvidence"("schoolId","requestKey");
-- The same school cannot reuse one claimed bank reference for another debt.
CREATE UNIQUE INDEX "PaymentEvidence_schoolId_referenceDigest_key"
  ON "PaymentEvidence"("schoolId","referenceDigest");
CREATE INDEX "PaymentEvidence_schoolId_obligationId_submittedAt_idx"
  ON "PaymentEvidence"("schoolId","obligationId","submittedAt");
ALTER TABLE "PaymentEvidence"
  ADD CONSTRAINT "PaymentEvidence_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentEvidence_obligation_fkey"
    FOREIGN KEY ("schoolId","obligationId")
    REFERENCES "FeeObligation"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentEvidence_submitter_fkey"
    FOREIGN KEY ("schoolId","submitterMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "PaymentVerificationDecision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "action" "PaymentVerificationAction" NOT NULL,
  "confirmedBankFunds" BOOLEAN NOT NULL,
  "confirmedReferenceDigest" VARCHAR(64),
  "reason" VARCHAR(500) NOT NULL,
  "reviewerMembershipId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentVerificationDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentVerificationDecision_values_check" CHECK (
    "reason"=btrim("reason")
    AND char_length("reason") BETWEEN 5 AND 500
    AND (
      ("action"='VERIFIED' AND "confirmedBankFunds"=true
        AND "confirmedReferenceDigest" ~ '^[a-f0-9]{64}
    )
  )
);
CREATE UNIQUE INDEX "PaymentVerificationDecision_schoolId_evidenceId_key"
  ON "PaymentVerificationDecision"("schoolId","evidenceId");
CREATE INDEX "PaymentVerificationDecision_schoolId_decidedAt_idx"
  ON "PaymentVerificationDecision"("schoolId","decidedAt");
ALTER TABLE "PaymentVerificationDecision"
  ADD CONSTRAINT "PaymentVerificationDecision_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerificationDecision_evidence_fkey"
    FOREIGN KEY ("schoolId","evidenceId")
    REFERENCES "PaymentEvidence"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerificationDecision_reviewer_fkey"
    FOREIGN KEY ("schoolId","reviewerMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_payment_evidence_insert"() RETURNS trigger AS $$
DECLARE charge_row RECORD;
BEGIN
  -- Serialize all claim and verification writes through the School lock.
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for payment evidence'
    USING ERRCODE='23503'; END IF;

  -- Only an existing SCHOOL_ADMIN can attest a submitted reference here.
  -- Parent/guardian/teacher/student cannot claim payment by guessing an ID.
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."submitterMembershipId"
      AND m."userId"=NEW."submitterUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_ADMIN'
  ) THEN RAISE EXCEPTION 'Exact active school payment submitter required'
    USING ERRCODE='23503'; END IF;

  SELECT o."amountMinor",o."currency" INTO charge_row
    FROM "FeeObligation" o
    WHERE o."schoolId"=NEW."schoolId" AND o."id"=NEW."obligationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school fee obligation required'
    USING ERRCODE='23503'; END IF;
  IF NEW."claimedAmountMinor">charge_row."amountMinor" OR
     NEW."currency"<>charge_row."currency" THEN
    RAISE EXCEPTION 'Claim outside obligation amount or currency'
      USING ERRCODE='23503';
  END IF;

  NEW."status":='SUBMITTED';
  NEW."submittedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_payment_verification_insert"() RETURNS trigger AS $$
DECLARE
  candidate RECORD;
  already_verified NUMERIC;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for verification'
    USING ERRCODE='23503'; END IF;

  SELECT evidence."obligationId",evidence."claimedAmountMinor",
    evidence."currency",evidence."referenceDigest",
    evidence."submitterMembershipId",charge."amountMinor" AS "owedAmount",
    charge."currency" AS "owedCurrency"
    INTO candidate
  FROM "PaymentEvidence" evidence
  JOIN "FeeObligation" charge ON charge."schoolId"=evidence."schoolId"
    AND charge."id"=evidence."obligationId"
  WHERE evidence."schoolId"=NEW."schoolId"
    AND evidence."id"=NEW."evidenceId"
    AND evidence."status"='SUBMITTED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Submitted school evidence required'
    USING ERRCODE='23503'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."reviewerMembershipId"
      AND m."userId"=NEW."reviewerUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) OR candidate."submitterMembershipId"=NEW."reviewerMembershipId"
  THEN RAISE EXCEPTION 'Independent active school payment reviewer required'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "PaymentVerificationDecision" prior
    WHERE prior."schoolId"=NEW."schoolId" AND prior."evidenceId"=NEW."evidenceId"
  ) THEN RAISE EXCEPTION 'Payment evidence already reviewed'
    USING ERRCODE='23505'; END IF;

  IF NEW."action"='VERIFIED' THEN
    IF NEW."confirmedBankFunds" IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Reviewer bank-funds attestation required'
        USING ERRCODE='23503'; END IF;
    IF NEW."confirmedReferenceDigest" IS DISTINCT FROM candidate."referenceDigest"
      OR candidate."currency"<>candidate."owedCurrency" THEN
      RAISE EXCEPTION 'Reviewer must match recorded bank reference and currency'
        USING ERRCODE='23503';
    END IF;
    -- Each claim is unique by bank reference. Never apply verified claims
    -- beyond this exact debt. Overpayment needs its own audited workflow.
    SELECT COALESCE(SUM(e."claimedAmountMinor"),0)::numeric INTO already_verified
      FROM "PaymentVerificationDecision" v
      JOIN "PaymentEvidence" e ON e."schoolId"=v."schoolId"
        AND e."id"=v."evidenceId"
      WHERE v."schoolId"=NEW."schoolId"
        AND e."obligationId"=candidate."obligationId"
        AND v."action"='VERIFIED';
    IF already_verified+candidate."claimedAmountMinor">candidate."owedAmount"
    THEN RAISE EXCEPTION 'Verified claims exceed exact obligation'
      USING ERRCODE='23503'; END IF;
  ELSIF NEW."action"='REJECTED' THEN
    IF NEW."confirmedBankFunds" IS DISTINCT FROM false
      OR NEW."confirmedReferenceDigest" IS NOT NULL THEN
      RAISE EXCEPTION 'Rejected claims cannot attest funds'
        USING ERRCODE='23503'; END IF;
  ELSE RAISE EXCEPTION 'Invalid payment verification outcome'
    USING ERRCODE='23503';
  END IF;

  NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentEvidence_validate"
  BEFORE INSERT ON "PaymentEvidence" FOR EACH ROW
  EXECUTE FUNCTION "validate_payment_evidence_insert"();
CREATE TRIGGER "PaymentVerificationDecision_validate"
  BEFORE INSERT ON "PaymentVerificationDecision" FOR EACH ROW
  EXECUTE FUNCTION "validate_payment_verification_insert"();

CREATE TRIGGER "PaymentEvidence_immutable"
  BEFORE UPDATE OR DELETE ON "PaymentEvidence" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PaymentEvidence_no_truncate"
  BEFORE TRUNCATE ON "PaymentEvidence" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "PaymentVerificationDecision_immutable"
  BEFORE UPDATE OR DELETE ON "PaymentVerificationDecision" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PaymentVerificationDecision_no_truncate"
  BEFORE TRUNCATE ON "PaymentVerificationDecision" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
)
      OR ("action"='REJECTED' AND "confirmedBankFunds"=false
        AND "confirmedReferenceDigest" IS NULL)
    )
  )
);
CREATE UNIQUE INDEX "PaymentVerificationDecision_schoolId_evidenceId_key"
  ON "PaymentVerificationDecision"("schoolId","evidenceId");
CREATE INDEX "PaymentVerificationDecision_schoolId_decidedAt_idx"
  ON "PaymentVerificationDecision"("schoolId","decidedAt");
ALTER TABLE "PaymentVerificationDecision"
  ADD CONSTRAINT "PaymentVerificationDecision_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerificationDecision_evidence_fkey"
    FOREIGN KEY ("schoolId","evidenceId")
    REFERENCES "PaymentEvidence"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerificationDecision_reviewer_fkey"
    FOREIGN KEY ("schoolId","reviewerMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_payment_evidence_insert"() RETURNS trigger AS $$
DECLARE charge_row RECORD;
BEGIN
  -- Serialize all claim and verification writes through the School lock.
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for payment evidence'
    USING ERRCODE='23503'; END IF;

  -- Only an existing SCHOOL_ADMIN can attest a submitted reference here.
  -- Parent/guardian/teacher/student cannot claim payment by guessing an ID.
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."submitterMembershipId"
      AND m."userId"=NEW."submitterUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_ADMIN'
  ) THEN RAISE EXCEPTION 'Exact active school payment submitter required'
    USING ERRCODE='23503'; END IF;

  SELECT o."amountMinor",o."currency" INTO charge_row
    FROM "FeeObligation" o
    WHERE o."schoolId"=NEW."schoolId" AND o."id"=NEW."obligationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school fee obligation required'
    USING ERRCODE='23503'; END IF;
  IF NEW."claimedAmountMinor">charge_row."amountMinor" OR
     NEW."currency"<>charge_row."currency" THEN
    RAISE EXCEPTION 'Claim outside obligation amount or currency'
      USING ERRCODE='23503';
  END IF;

  NEW."status":='SUBMITTED';
  NEW."submittedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_payment_verification_insert"() RETURNS trigger AS $$
DECLARE candidate RECORD;
DECLARE already_verified NUMERIC;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for verification'
    USING ERRCODE='23503'; END IF;

  SELECT evidence."obligationId",evidence."claimedAmountMinor",
    evidence."currency",evidence."referenceDigest",
    evidence."submitterMembershipId",charge."amountMinor" AS "owedAmount",
    charge."currency" AS "owedCurrency"
    INTO candidate
  FROM "PaymentEvidence" evidence
  JOIN "FeeObligation" charge ON charge."schoolId"=evidence."schoolId"
    AND charge."id"=evidence."obligationId"
  WHERE evidence."schoolId"=NEW."schoolId"
    AND evidence."id"=NEW."evidenceId"
    AND evidence."status"='SUBMITTED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Submitted school evidence required'
    USING ERRCODE='23503'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."reviewerMembershipId"
      AND m."userId"=NEW."reviewerUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) OR candidate."submitterMembershipId"=NEW."reviewerMembershipId"
  THEN RAISE EXCEPTION 'Independent active school payment reviewer required'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "PaymentVerificationDecision" prior
    WHERE prior."schoolId"=NEW."schoolId" AND prior."evidenceId"=NEW."evidenceId"
  ) THEN RAISE EXCEPTION 'Payment evidence already reviewed'
    USING ERRCODE='23505'; END IF;

  IF NEW."action"='VERIFIED' THEN
    IF NEW."confirmedReferenceDigest" IS DISTINCT FROM candidate."referenceDigest"
      OR candidate."currency"<>candidate."owedCurrency" THEN
      RAISE EXCEPTION 'Reviewer must match recorded bank reference and currency'
        USING ERRCODE='23503';
    END IF;
    -- Each claim is unique by bank reference. Never apply verified claims
    -- beyond this exact debt. Overpayment needs its own audited workflow.
    SELECT COALESCE(SUM(e."claimedAmountMinor"),0)::numeric INTO already_verified
      FROM "PaymentVerificationDecision" v
      JOIN "PaymentEvidence" e ON e."schoolId"=v."schoolId"
        AND e."id"=v."evidenceId"
      WHERE v."schoolId"=NEW."schoolId"
        AND e."obligationId"=candidate."obligationId"
        AND v."action"='VERIFIED';
    IF already_verified+candidate."claimedAmountMinor">candidate."owedAmount"
    THEN RAISE EXCEPTION 'Verified claims exceed exact obligation'
      USING ERRCODE='23503'; END IF;
  ELSIF NEW."action"='REJECTED' THEN
    IF NEW."confirmedReferenceDigest" IS NOT NULL THEN
      RAISE EXCEPTION 'Rejected claims cannot attest funds'
        USING ERRCODE='23503'; END IF;
  ELSE RAISE EXCEPTION 'Invalid payment verification outcome'
    USING ERRCODE='23503';
  END IF;

  NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentEvidence_validate"
  BEFORE INSERT ON "PaymentEvidence" FOR EACH ROW
  EXECUTE FUNCTION "validate_payment_evidence_insert"();
CREATE TRIGGER "PaymentVerificationDecision_validate"
  BEFORE INSERT ON "PaymentVerificationDecision" FOR EACH ROW
  EXECUTE FUNCTION "validate_payment_verification_insert"();

CREATE TRIGGER "PaymentEvidence_immutable"
  BEFORE UPDATE OR DELETE ON "PaymentEvidence" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PaymentEvidence_no_truncate"
  BEFORE TRUNCATE ON "PaymentEvidence" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "PaymentVerificationDecision_immutable"
  BEFORE UPDATE OR DELETE ON "PaymentVerificationDecision" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PaymentVerificationDecision_no_truncate"
  BEFORE TRUNCATE ON "PaymentVerificationDecision" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Phase 9: controlled INTERNAL waiver applications from independently
-- approved WAIVER proposals. This is NOT receipt/settlement/refund.
-- School row lock serializes application with claim verification/allocation.
CREATE UNIQUE INDEX "FeeAdjustmentDecision_schoolId_id_key"
  ON "FeeAdjustmentDecision"("schoolId","id");

CREATE TABLE "FeeWaiverApplication" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "applierMembershipId" TEXT NOT NULL,
  "applierUserId" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeWaiverApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeWaiverApplication_values_check" CHECK (
    "amountMinor">0 AND "amountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    AND "reason"=btrim("reason")
    AND char_length("reason") BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "FeeWaiverApplication_schoolId_id_key"
  ON "FeeWaiverApplication"("schoolId","id");
CREATE UNIQUE INDEX "FeeWaiverApplication_schoolId_requestKey_key"
  ON "FeeWaiverApplication"("schoolId","requestKey");
CREATE UNIQUE INDEX "FeeWaiverApplication_schoolId_proposalId_key"
  ON "FeeWaiverApplication"("schoolId","proposalId");
CREATE UNIQUE INDEX "FeeWaiverApplication_schoolId_decisionId_key"
  ON "FeeWaiverApplication"("schoolId","decisionId");
CREATE INDEX "FeeWaiverApplication_schoolId_obligationId_appliedAt_idx"
  ON "FeeWaiverApplication"("schoolId","obligationId","appliedAt");

ALTER TABLE "FeeWaiverApplication"
  ADD CONSTRAINT "FeeWaiverApplication_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeWaiverApplication_obligation_fkey"
    FOREIGN KEY ("schoolId","obligationId")
    REFERENCES "FeeObligation"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeWaiverApplication_proposal_fkey"
    FOREIGN KEY ("schoolId","proposalId")
    REFERENCES "FeeAdjustmentProposal"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeWaiverApplication_decision_fkey"
    FOREIGN KEY ("schoolId","decisionId")
    REFERENCES "FeeAdjustmentDecision"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeWaiverApplication_applier_fkey"
    FOREIGN KEY ("schoolId","applierMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_fee_waiver_application_insert"() RETURNS trigger AS $$
DECLARE
  source RECORD;
  waived_total NUMERIC;
  verified_total NUMERIC;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for waiver'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."applierMembershipId"
      AND m."userId"=NEW."applierUserId" AND m."isActive"=true
      AND m."role"='SCHOOL_SUPER_ADMIN'
  ) THEN RAISE EXCEPTION 'Current same-school School Super Admin required'
    USING ERRCODE='23503'; END IF;

  SELECT proposal."id" AS "proposalId", proposal."obligationId",
    proposal."kind", proposal."proposedAmountMinor" AS "waiverAmount",
    proposal."currency" AS "waiverCurrency",
    proposal."proposerMembershipId", decision."id" AS "decisionId",
    debt."amountMinor" AS "originalAmount",
    debt."currency" AS "originalCurrency"
  INTO source
  FROM "FeeAdjustmentProposal" proposal
  JOIN "FeeAdjustmentDecision" decision
    ON decision."schoolId"=proposal."schoolId"
    AND decision."proposalId"=proposal."id"
  JOIN "FeeObligation" debt
    ON debt."schoolId"=proposal."schoolId"
    AND debt."id"=proposal."obligationId"
  WHERE proposal."schoolId"=NEW."schoolId"
    AND proposal."id"=NEW."proposalId"
    AND decision."id"=NEW."decisionId"
    AND decision."action"='APPROVED'
    AND proposal."kind"='WAIVER'
    AND debt."id"=NEW."obligationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact approved WAIVER for same-school debt required'
    USING ERRCODE='23503'; END IF;
  IF source."waiverAmount">source."originalAmount"
     OR source."waiverCurrency"<>source."originalCurrency"
  THEN RAISE EXCEPTION 'Approved waiver amount or currency conflicts with original charge'
    USING ERRCODE='23503'; END IF;
  IF source."proposerMembershipId"=NEW."applierMembershipId"
  THEN RAISE EXCEPTION 'Original waiver proposer cannot self-apply'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "FeeWaiverApplication" prior
    WHERE prior."schoolId"=NEW."schoolId"
      AND (prior."proposalId"=NEW."proposalId"
        OR prior."decisionId"=NEW."decisionId")
  ) THEN RAISE EXCEPTION 'Approved waiver already applied'
    USING ERRCODE='23505'; END IF;

  SELECT COALESCE(SUM(app."amountMinor"),0)::numeric INTO waived_total
  FROM "FeeWaiverApplication" app
  WHERE app."schoolId"=NEW."schoolId"
    AND app."obligationId"=NEW."obligationId";
  -- Count ALL human VERIFIED claims, including a later reversed
  -- manual allocation. This conservatively disallows waiver of
  -- already-attested funds without a separately audited refund.
  SELECT COALESCE(SUM(e."claimedAmountMinor"),0)::numeric INTO verified_total
  FROM "PaymentEvidence" e
  JOIN "PaymentVerificationDecision" v ON v."schoolId"=e."schoolId"
    AND v."evidenceId"=e."id" AND v."action"='VERIFIED'
    AND v."confirmedBankFunds"=true
    AND v."confirmedReferenceDigest"=e."referenceDigest"
  WHERE e."schoolId"=NEW."schoolId"
    AND e."obligationId"=NEW."obligationId";
  IF waived_total+verified_total+source."waiverAmount">source."originalAmount"
  THEN RAISE EXCEPTION 'Applied waivers plus reviewed claims exceed original charge'
    USING ERRCODE='23503'; END IF;

  -- Never trust amount, currency or applied timestamp from clients.
  NEW."amountMinor":=source."waiverAmount";
  NEW."currency":=source."originalCurrency";
  NEW."appliedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeeWaiverApplication_validate"
  BEFORE INSERT ON "FeeWaiverApplication" FOR EACH ROW
  EXECUTE FUNCTION "validate_fee_waiver_application_insert"();
CREATE TRIGGER "FeeWaiverApplication_immutable"
  BEFORE UPDATE OR DELETE ON "FeeWaiverApplication" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeWaiverApplication_no_truncate"
  BEFORE TRUNCATE ON "FeeWaiverApplication" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Without these extra INSERT guards, a VERIFIED claim arriving after a
-- waiver could exceed the new net-charge cap. Guard BOTH directions.
-- The earlier validator still enforces reviewer/funds/reference authenticity.
CREATE FUNCTION "validate_fee_waiver_payment_verification_limit"() RETURNS trigger AS $$
DECLARE
  source RECORD;
  waived_total NUMERIC;
  verified_total NUMERIC;
BEGIN
  IF NEW."action"<>'VERIFIED' THEN RETURN NEW; END IF;
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for verification'
    USING ERRCODE='23503'; END IF;
  SELECT e."obligationId",e."claimedAmountMinor",
    debt."amountMinor" AS "originalAmount"
  INTO source FROM "PaymentEvidence" e
  JOIN "FeeObligation" debt ON debt."schoolId"=e."schoolId"
    AND debt."id"=e."obligationId"
  WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."evidenceId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school claim required'
    USING ERRCODE='23503'; END IF;
  SELECT COALESCE(SUM(app."amountMinor"),0)::numeric INTO waived_total
  FROM "FeeWaiverApplication" app
  WHERE app."schoolId"=NEW."schoolId"
    AND app."obligationId"=source."obligationId";
  SELECT COALESCE(SUM(e."claimedAmountMinor"),0)::numeric INTO verified_total
  FROM "PaymentEvidence" e
  JOIN "PaymentVerificationDecision" v ON v."schoolId"=e."schoolId"
    AND v."evidenceId"=e."id" AND v."action"='VERIFIED'
  WHERE e."schoolId"=NEW."schoolId"
    AND e."obligationId"=source."obligationId";
  IF waived_total+verified_total+source."claimedAmountMinor">source."originalAmount"
  THEN RAISE EXCEPTION 'Human verification exceeds adjusted fee debt'
    USING ERRCODE='23503'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentVerificationDecision_waiver_limit"
  BEFORE INSERT ON "PaymentVerificationDecision" FOR EACH ROW
  EXECUTE FUNCTION "validate_fee_waiver_payment_verification_limit"();

-- The original allocation validator caps against gross charge.
-- Preserve that invariant and add the net-charge cap for new allocations.
CREATE FUNCTION "validate_fee_waiver_allocation_limit"() RETURNS trigger AS $$
DECLARE
  source RECORD;
  waived_total NUMERIC;
  allocated_total NUMERIC;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for allocation'
    USING ERRCODE='23503'; END IF;
  SELECT claim."claimedAmountMinor",debt."amountMinor" AS "originalAmount"
  INTO source FROM "PaymentEvidence" claim
  JOIN "FeeObligation" debt ON debt."schoolId"=claim."schoolId"
    AND debt."id"=claim."obligationId"
  WHERE claim."schoolId"=NEW."schoolId"
    AND claim."id"=NEW."evidenceId"
    AND debt."id"=NEW."obligationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school evidence and debt required'
    USING ERRCODE='23503'; END IF;
  SELECT COALESCE(SUM(app."amountMinor"),0)::numeric INTO waived_total
  FROM "FeeWaiverApplication" app
  WHERE app."schoolId"=NEW."schoolId"
    AND app."obligationId"=NEW."obligationId";
  SELECT COALESCE(SUM(app."amountMinor"),0)::numeric INTO allocated_total
  FROM "ManualPaymentAllocation" app
  WHERE app."schoolId"=NEW."schoolId"
    AND app."obligationId"=NEW."obligationId";
  IF waived_total+allocated_total+source."claimedAmountMinor">source."originalAmount"
  THEN RAISE EXCEPTION 'Manual allocations exceed fee after waivers'
    USING ERRCODE='23503'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManualPaymentAllocation_waiver_limit"
  BEFORE INSERT ON "ManualPaymentAllocation" FOR EACH ROW
  EXECUTE FUNCTION "validate_fee_waiver_allocation_limit"();

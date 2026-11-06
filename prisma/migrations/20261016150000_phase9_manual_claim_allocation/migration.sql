-- Phase 9: append-only application of manual bank-review attestations.
-- These are local PREVIEW allocations only. No settlement, funds movement,
-- official balance, verified receipt or provider-issued payment status.
-- Requires immutable obligation/evidence/decision ledgers from prior migrations.
CREATE UNIQUE INDEX "PaymentVerificationDecision_schoolId_id_key"
  ON "PaymentVerificationDecision"("schoolId","id");

CREATE TABLE "ManualPaymentAllocation" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "allocatorMembershipId" TEXT NOT NULL,
  "allocatorUserId" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualPaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualPaymentAllocation_values_check" CHECK (
    "amountMinor">0 AND "amountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    AND "reason"=btrim("reason")
    AND char_length("reason") BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "ManualPaymentAllocation_schoolId_id_key"
  ON "ManualPaymentAllocation"("schoolId","id");
CREATE UNIQUE INDEX "ManualPaymentAllocation_schoolId_requestKey_key"
  ON "ManualPaymentAllocation"("schoolId","requestKey");
CREATE UNIQUE INDEX "ManualPaymentAllocation_schoolId_evidenceId_key"
  ON "ManualPaymentAllocation"("schoolId","evidenceId");
CREATE UNIQUE INDEX "ManualPaymentAllocation_schoolId_verificationId_key"
  ON "ManualPaymentAllocation"("schoolId","verificationId");
CREATE INDEX "ManualPaymentAllocation_schoolId_obligationId_allocatedAt_idx"
  ON "ManualPaymentAllocation"("schoolId","obligationId","allocatedAt");
ALTER TABLE "ManualPaymentAllocation"
  ADD CONSTRAINT "ManualPaymentAllocation_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualPaymentAllocation_obligation_fkey"
    FOREIGN KEY ("schoolId","obligationId")
    REFERENCES "FeeObligation"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualPaymentAllocation_evidence_fkey"
    FOREIGN KEY ("schoolId","evidenceId")
    REFERENCES "PaymentEvidence"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualPaymentAllocation_verification_fkey"
    FOREIGN KEY ("schoolId","verificationId")
    REFERENCES "PaymentVerificationDecision"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualPaymentAllocation_allocator_fkey"
    FOREIGN KEY ("schoolId","allocatorMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_manual_payment_allocation_insert"() RETURNS trigger AS $$
DECLARE
  source RECORD;
  previously_allocated NUMERIC;
BEGIN
  -- Every decision and allocation serializes by the SAME school row.
  -- A concurrent duplicate/review/other allocation cannot evade the cap.
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for manual allocation'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."schoolId"=NEW."schoolId"
      AND m."id"=NEW."allocatorMembershipId"
      AND m."userId"=NEW."allocatorUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) THEN RAISE EXCEPTION 'Active school payment allocator required'
    USING ERRCODE='23503'; END IF;

  SELECT e."id" AS "evidenceId", e."obligationId", e."claimedAmountMinor",
    e."currency", e."referenceDigest", e."submitterMembershipId",
    v."id" AS "verificationId", v."confirmedReferenceDigest",
    v."confirmedBankFunds", v."action",
    owed."amountMinor" AS "owedAmount", owed."currency" AS "owedCurrency"
    INTO source
  FROM "PaymentVerificationDecision" v
  JOIN "PaymentEvidence" e ON e."schoolId"=v."schoolId"
    AND e."id"=v."evidenceId"
  JOIN "FeeObligation" owed ON owed."schoolId"=e."schoolId"
    AND owed."id"=e."obligationId"
  WHERE v."schoolId"=NEW."schoolId"
    AND v."id"=NEW."verificationId"
    AND e."id"=NEW."evidenceId"
    AND owed."id"=NEW."obligationId"
    AND e."status"='SUBMITTED'
    AND v."action"='VERIFIED'
    AND v."confirmedBankFunds"=true
    AND v."confirmedReferenceDigest"=e."referenceDigest";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact independently verified school claim required'
    USING ERRCODE='23503'; END IF;
  IF source."currency"<>source."owedCurrency"
    OR source."claimedAmountMinor">source."owedAmount"
  THEN RAISE EXCEPTION 'Source claim money and original debt must agree'
    USING ERRCODE='23503'; END IF;
  IF source."submitterMembershipId"=NEW."allocatorMembershipId"
  THEN RAISE EXCEPTION 'Claim submitter cannot allocate own evidence'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "ManualPaymentAllocation" prior
    WHERE prior."schoolId"=NEW."schoolId"
      AND (prior."evidenceId"=NEW."evidenceId"
        OR prior."verificationId"=NEW."verificationId")
  ) THEN RAISE EXCEPTION 'Manual evidence already allocated'
    USING ERRCODE='23505'; END IF;

  SELECT COALESCE(SUM(previous."amountMinor"),0)::numeric INTO previously_allocated
    FROM "ManualPaymentAllocation" previous
    WHERE previous."schoolId"=NEW."schoolId"
      AND previous."obligationId"=NEW."obligationId";
  IF previously_allocated+source."claimedAmountMinor">source."owedAmount"
  THEN RAISE EXCEPTION 'Manual allocation exceeds original fee obligation'
    USING ERRCODE='23503'; END IF;

  -- Never trust client-supplied amount, currency or paid timestamp.
  -- Foreign-key-bound source and school owner decide actual allocation.
  NEW."amountMinor":=source."claimedAmountMinor";
  NEW."currency":=source."currency";
  NEW."allocatedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManualPaymentAllocation_validate"
  BEFORE INSERT ON "ManualPaymentAllocation" FOR EACH ROW
  EXECUTE FUNCTION "validate_manual_payment_allocation_insert"();
CREATE TRIGGER "ManualPaymentAllocation_immutable"
  BEFORE UPDATE OR DELETE ON "ManualPaymentAllocation" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ManualPaymentAllocation_no_truncate"
  BEFORE TRUNCATE ON "ManualPaymentAllocation" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

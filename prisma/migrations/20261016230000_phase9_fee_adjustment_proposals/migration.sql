-- Phase 9: audited waiver/correction PROPOSALS, not effective adjustments.
-- An approved proposal never changes an issued fee, payment, balance,
-- original debt, allocation, or official receipt.
CREATE TYPE "FeeAdjustmentKind" AS ENUM ('WAIVER','CORRECTION_PROPOSAL');
CREATE TYPE "FeeAdjustmentDecisionAction" AS ENUM ('APPROVED','REJECTED');

CREATE TABLE "FeeAdjustmentProposal" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "kind" "FeeAdjustmentKind" NOT NULL,
  "proposedAmountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "proposerMembershipId" TEXT NOT NULL,
  "proposerUserId" TEXT NOT NULL,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeAdjustmentProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeAdjustmentProposal_values_check" CHECK (
    "proposedAmountMinor">0 AND "proposedAmountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    AND "reason"=btrim("reason") AND char_length("reason") BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "FeeAdjustmentProposal_schoolId_id_key"
  ON "FeeAdjustmentProposal"("schoolId","id");
CREATE UNIQUE INDEX "FeeAdjustmentProposal_schoolId_requestKey_key"
  ON "FeeAdjustmentProposal"("schoolId","requestKey");
CREATE INDEX "FeeAdjustmentProposal_schoolId_obligationId_proposedAt_idx"
  ON "FeeAdjustmentProposal"("schoolId","obligationId","proposedAt");
ALTER TABLE "FeeAdjustmentProposal"
  ADD CONSTRAINT "FeeAdjustmentProposal_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeAdjustmentProposal_obligation_fkey"
    FOREIGN KEY ("schoolId","obligationId")
    REFERENCES "FeeObligation"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeAdjustmentProposal_proposer_fkey"
    FOREIGN KEY ("schoolId","proposerMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "FeeAdjustmentDecision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "action" "FeeAdjustmentDecisionAction" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "reviewerMembershipId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeAdjustmentDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeAdjustmentDecision_values_check" CHECK (
    "reason"=btrim("reason") AND char_length("reason") BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "FeeAdjustmentDecision_schoolId_proposalId_key"
  ON "FeeAdjustmentDecision"("schoolId","proposalId");
CREATE INDEX "FeeAdjustmentDecision_schoolId_decidedAt_idx"
  ON "FeeAdjustmentDecision"("schoolId","decidedAt");
ALTER TABLE "FeeAdjustmentDecision"
  ADD CONSTRAINT "FeeAdjustmentDecision_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeAdjustmentDecision_proposal_fkey"
    FOREIGN KEY ("schoolId","proposalId")
    REFERENCES "FeeAdjustmentProposal"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "FeeAdjustmentDecision_reviewer_fkey"
    FOREIGN KEY ("schoolId","reviewerMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_fee_adjustment_proposal_insert"() RETURNS trigger AS $$
DECLARE obligation RECORD;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId"
      AND m."id"=NEW."proposerMembershipId"
      AND m."userId"=NEW."proposerUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_ADMIN'
  ) THEN RAISE EXCEPTION 'Same-school School Administrator required'
    USING ERRCODE='23503'; END IF;
  SELECT o."amountMinor",o."currency" INTO obligation
    FROM "FeeObligation" o
    WHERE o."schoolId"=NEW."schoolId" AND o."id"=NEW."obligationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school obligation required'
    USING ERRCODE='23503'; END IF;
  IF NEW."proposedAmountMinor">obligation."amountMinor" OR
     NEW."currency"<>obligation."currency" THEN
    RAISE EXCEPTION 'Adjustment proposal cannot exceed original charge or change currency'
      USING ERRCODE='23503'; END IF;
  NEW."proposedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_fee_adjustment_decision_insert"() RETURNS trigger AS $$
DECLARE original RECORD;
BEGIN
  PERFORM 1 FROM "School" s WHERE s."id"=NEW."schoolId"
    AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required'
    USING ERRCODE='23503'; END IF;
  SELECT proposal."proposerMembershipId",
    proposal."proposedAmountMinor",proposal."currency",
    debt."amountMinor" AS "originalAmount",
    debt."currency" AS "originalCurrency"
    INTO original FROM "FeeAdjustmentProposal" proposal
    JOIN "FeeObligation" debt ON debt."schoolId"=proposal."schoolId"
      AND debt."id"=proposal."obligationId"
    WHERE proposal."schoolId"=NEW."schoolId"
      AND proposal."id"=NEW."proposalId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school proposal required'
    USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId"
      AND m."id"=NEW."reviewerMembershipId"
      AND m."userId"=NEW."reviewerUserId"
      AND m."isActive"=true AND m."role"='SCHOOL_SUPER_ADMIN'
  ) OR NEW."reviewerMembershipId"=original."proposerMembershipId"
  THEN RAISE EXCEPTION 'Independent School Super Admin reviewer required'
    USING ERRCODE='23503'; END IF;
  IF original."proposedAmountMinor">original."originalAmount"
     OR original."currency"<>original."originalCurrency"
  THEN RAISE EXCEPTION 'Original fee proposal identity changed'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "FeeAdjustmentDecision" prior
    WHERE prior."schoolId"=NEW."schoolId"
      AND prior."proposalId"=NEW."proposalId"
  ) THEN RAISE EXCEPTION 'Decision already exists' USING ERRCODE='23505'; END IF;
  NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeeAdjustmentProposal_validate"
  BEFORE INSERT ON "FeeAdjustmentProposal" FOR EACH ROW
  EXECUTE FUNCTION "validate_fee_adjustment_proposal_insert"();
CREATE TRIGGER "FeeAdjustmentProposal_immutable"
  BEFORE UPDATE OR DELETE ON "FeeAdjustmentProposal" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeAdjustmentProposal_no_truncate"
  BEFORE TRUNCATE ON "FeeAdjustmentProposal" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "FeeAdjustmentDecision_validate"
  BEFORE INSERT ON "FeeAdjustmentDecision" FOR EACH ROW
  EXECUTE FUNCTION "validate_fee_adjustment_decision_insert"();
CREATE TRIGGER "FeeAdjustmentDecision_immutable"
  BEFORE UPDATE OR DELETE ON "FeeAdjustmentDecision" FOR EACH ROW
  EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeAdjustmentDecision_no_truncate"
  BEFORE TRUNCATE ON "FeeAdjustmentDecision" FOR EACH STATEMENT
  EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

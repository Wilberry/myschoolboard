-- Manual PREVIEW allocation reversal requests and independent decisions.
-- No refund, no settled funds movement, no official payment status, and
-- NO mutation of the original reviewed claim, verification or allocation.
CREATE TYPE "ManualAllocationReversalAction" AS ENUM ('APPROVED','REJECTED');

CREATE TABLE "ManualAllocationReversalRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "requestKey" VARCHAR(64) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "requesterMembershipId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualAllocationReversalRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualAllocationReversalRequest_values_check" CHECK (
    "amountMinor">0 AND "amountMinor"<=1000000000000
    AND "currency" ~ '^[A-Z]{3}$'
    AND "reason"=btrim("reason")
    AND char_length("reason") BETWEEN 5 AND 500
    AND "requestKey" ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  )
);
CREATE UNIQUE INDEX "ManualAllocationReversalRequest_schoolId_id_key"
  ON "ManualAllocationReversalRequest"("schoolId","id");
CREATE UNIQUE INDEX "ManualAllocationReversalRequest_schoolId_requestKey_key"
  ON "ManualAllocationReversalRequest"("schoolId","requestKey");
CREATE UNIQUE INDEX "ManualAllocationReversalRequest_schoolId_allocationId_key"
  ON "ManualAllocationReversalRequest"("schoolId","allocationId");
CREATE INDEX "ManualAllocationReversalRequest_schoolId_requestedAt_idx"
  ON "ManualAllocationReversalRequest"("schoolId","requestedAt");
ALTER TABLE "ManualAllocationReversalRequest"
  ADD CONSTRAINT "ManualAllocationReversalRequest_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualAllocationReversalRequest_allocation_fkey"
    FOREIGN KEY ("schoolId","allocationId")
    REFERENCES "ManualPaymentAllocation"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualAllocationReversalRequest_requester_fkey"
    FOREIGN KEY ("schoolId","requesterMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "ManualAllocationReversalDecision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" "ManualAllocationReversalAction" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "reviewerMembershipId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualAllocationReversalDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualAllocationReversalDecision_values_check" CHECK (
    "reason"=btrim("reason")
    AND char_length("reason") BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "ManualAllocationReversalDecision_schoolId_requestId_key"
  ON "ManualAllocationReversalDecision"("schoolId","requestId");
CREATE INDEX "ManualAllocationReversalDecision_schoolId_decidedAt_idx"
  ON "ManualAllocationReversalDecision"("schoolId","decidedAt");
ALTER TABLE "ManualAllocationReversalDecision"
  ADD CONSTRAINT "ManualAllocationReversalDecision_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualAllocationReversalDecision_request_fkey"
    FOREIGN KEY ("schoolId","requestId")
    REFERENCES "ManualAllocationReversalRequest"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "ManualAllocationReversalDecision_reviewer_fkey"
    FOREIGN KEY ("schoolId","reviewerMembershipId")
    REFERENCES "Membership"("schoolId","id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_manual_allocation_reversal_request_insert"() RETURNS trigger AS $$
DECLARE
  source RECORD;
BEGIN
  -- All claim, allocation, request and decision transitions use this lock.
  PERFORM 1 FROM "School" s
    WHERE s."id"=NEW."schoolId" AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for manual allocation reversal'
      USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
      WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."requesterMembershipId"
        AND m."userId"=NEW."requesterUserId"
        AND m."isActive"=true AND m."role"='SCHOOL_ADMIN'
  ) THEN RAISE EXCEPTION 'Active School Administrator required to request reversal'
    USING ERRCODE='23503'; END IF;
  SELECT a."amountMinor",a."currency",a."obligationId"
    INTO source
    FROM "ManualPaymentAllocation" a
    JOIN "FeeObligation" o ON o."schoolId"=a."schoolId"
      AND o."id"=a."obligationId" AND o."currency"=a."currency"
    WHERE a."schoolId"=NEW."schoolId" AND a."id"=NEW."allocationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact existing school allocation required'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "ManualAllocationReversalRequest" prior
      WHERE prior."schoolId"=NEW."schoolId"
        AND prior."allocationId"=NEW."allocationId"
  ) THEN RAISE EXCEPTION 'A reversal was already requested for this allocation'
    USING ERRCODE='23505'; END IF;

  -- Reverse only the original WHOLE manual preview allocation.
  -- Caller amount/currency/timestamps are disregarded even by raw SQL.
  NEW."amountMinor":=source."amountMinor";
  NEW."currency":=source."currency";
  NEW."requestedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_manual_allocation_reversal_decision_insert"() RETURNS trigger AS $$
DECLARE
  original RECORD;
BEGIN
  PERFORM 1 FROM "School" s
    WHERE s."id"=NEW."schoolId" AND s."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active school required for reversal decision'
    USING ERRCODE='23503'; END IF;
  SELECT req."requesterMembershipId",req."allocationId",
    req."amountMinor",req."currency",alloc."amountMinor" AS "originalAmount",
    alloc."currency" AS "originalCurrency"
    INTO original
  FROM "ManualAllocationReversalRequest" req
  JOIN "ManualPaymentAllocation" alloc ON alloc."schoolId"=req."schoolId"
    AND alloc."id"=req."allocationId"
  WHERE req."schoolId"=NEW."schoolId"
    AND req."id"=NEW."requestId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact school reversal request required'
    USING ERRCODE='23503'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership" m
      WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."reviewerMembershipId"
        AND m."userId"=NEW."reviewerUserId" AND m."isActive"=true
        AND m."role"='SCHOOL_SUPER_ADMIN'
  ) OR NEW."reviewerMembershipId"=original."requesterMembershipId"
  THEN RAISE EXCEPTION 'Independent School Super Admin reviewer required'
    USING ERRCODE='23503'; END IF;
  IF original."amountMinor"<>original."originalAmount"
    OR original."currency"<>original."originalCurrency"
  THEN RAISE EXCEPTION 'Immutable reversal request must match original allocation'
    USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM "ManualAllocationReversalDecision" prior
      WHERE prior."schoolId"=NEW."schoolId" AND prior."requestId"=NEW."requestId"
  ) THEN RAISE EXCEPTION 'Reversal request was already decided'
    USING ERRCODE='23505'; END IF;

  -- The two terminal actions are distinct; REJECTED never cancels
  -- the original allocation. Neither action creates a bank refund.
  NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManualAllocationReversalRequest_validate"
 BEFORE INSERT ON "ManualAllocationReversalRequest" FOR EACH ROW
 EXECUTE FUNCTION "validate_manual_allocation_reversal_request_insert"();
CREATE TRIGGER "ManualAllocationReversalRequest_immutable"
 BEFORE UPDATE OR DELETE ON "ManualAllocationReversalRequest" FOR EACH ROW
 EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ManualAllocationReversalRequest_no_truncate"
 BEFORE TRUNCATE ON "ManualAllocationReversalRequest" FOR EACH STATEMENT
 EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

CREATE TRIGGER "ManualAllocationReversalDecision_validate"
 BEFORE INSERT ON "ManualAllocationReversalDecision" FOR EACH ROW
 EXECUTE FUNCTION "validate_manual_allocation_reversal_decision_insert"();
CREATE TRIGGER "ManualAllocationReversalDecision_immutable"
 BEFORE UPDATE OR DELETE ON "ManualAllocationReversalDecision" FOR EACH ROW
 EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ManualAllocationReversalDecision_no_truncate"
 BEFORE TRUNCATE ON "ManualAllocationReversalDecision" FOR EACH STATEMENT
 EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

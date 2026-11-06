-- Explicit school release of a financial account, never a bank/provider status.
CREATE TABLE "FeeAccountRelease" (
 "id" TEXT PRIMARY KEY,
 "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
 "obligationId" TEXT NOT NULL,
 "requestKey" UUID NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision">0),
 "action" VARCHAR(16) NOT NULL CHECK ("action" IN ('PUBLISHED','WITHDRAWN')),
 "visibility" VARCHAR(32) NOT NULL CHECK ("visibility" IN
  ('STAFF_ONLY','GUARDIAN_ONLY','STUDENT_ONLY','STUDENT_AND_GUARDIAN')),
 "reason" VARCHAR(500) NOT NULL CHECK ("reason"=btrim("reason") AND length("reason") BETWEEN 5 AND 500),
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","id"), UNIQUE ("schoolId","requestKey"),
 UNIQUE ("schoolId","obligationId","revision"),
 FOREIGN KEY ("schoolId","obligationId") REFERENCES "FeeObligation"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);
CREATE FUNCTION "validate_fee_account_release"() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive" FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM "Membership" m
  WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."actorMembershipId"
    AND m."userId"=NEW."actorUserId" AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive") THEN
  RAISE EXCEPTION 'Current school owner required' USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM "FeeObligation" o WHERE o."schoolId"=NEW."schoolId" AND o."id"=NEW."obligationId") THEN
  RAISE EXCEPTION 'Exact school obligation required' USING ERRCODE='23503';
 END IF;
 SELECT COALESCE(max("revision"),0)+1 INTO NEW."revision" FROM "FeeAccountRelease"
 WHERE "schoolId"=NEW."schoolId" AND "obligationId"=NEW."obligationId";
 NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FeeAccountRelease_validate" BEFORE INSERT ON "FeeAccountRelease"
 FOR EACH ROW EXECUTE FUNCTION "validate_fee_account_release"();
CREATE TRIGGER "FeeAccountRelease_immutable" BEFORE UPDATE OR DELETE ON "FeeAccountRelease"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeAccountRelease_no_truncate" BEFORE TRUNCATE ON "FeeAccountRelease"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Original charges, applied waivers and NET reviewed allocations remain separate.
-- Pending/manual reference submissions NEVER credit this balance. No float math.
CREATE VIEW "FeeAccountBalance" AS
 SELECT o."id" AS "obligationId",o."schoolId",o."studentId",o."sessionId",o."termId",o."classId",o."categoryId",o."currency",
   o."amountMinor"::numeric AS "originalChargeMinor",
   COALESCE(w.amount,0)::numeric AS "waivedMinor",
   COALESCE(a.gross,0)::numeric AS "grossAllocatedMinor",
   COALESCE(a.reversed,0)::numeric AS "reversedMinor",
   (COALESCE(a.gross,0)-COALESCE(a.reversed,0))::numeric AS "allocatedMinor",
   (o."amountMinor"::numeric-COALESCE(w.amount,0)-COALESCE(a.gross,0)+COALESCE(a.reversed,0))::numeric AS "remainingMinor"
 FROM "FeeObligation" o
 LEFT JOIN LATERAL (SELECT SUM("amountMinor")::numeric AS amount FROM "FeeWaiverApplication" x
   WHERE x."schoolId"=o."schoolId" AND x."obligationId"=o."id" AND x."currency"=o."currency") w ON true
 LEFT JOIN LATERAL (
  SELECT SUM(x."amountMinor")::numeric AS gross,
    SUM(CASE WHEN d."action"='APPROVED' THEN x."amountMinor" ELSE 0 END)::numeric AS reversed
  FROM "ManualPaymentAllocation" x
  LEFT JOIN "ManualAllocationReversalRequest" r ON r."schoolId"=x."schoolId" AND r."allocationId"=x."id"
  LEFT JOIN "ManualAllocationReversalDecision" d ON d."schoolId"=r."schoolId" AND d."requestId"=r."id"
  WHERE x."schoolId"=o."schoolId" AND x."obligationId"=o."id" AND x."currency"=o."currency"
 ) a ON true;

CREATE FUNCTION "can_read_fee_account"(p_school TEXT,p_obligation TEXT,p_user TEXT)
RETURNS BOOLEAN AS $$
BEGIN
 RETURN EXISTS (
  SELECT 1 FROM "School" school
  JOIN "Membership" member ON member."schoolId"=school."id" AND member."userId"=p_user AND member."isActive"
  JOIN "FeeObligation" o ON o."schoolId"=school."id" AND o."id"=p_obligation
  JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id" AND pupil."id"=o."studentId" AND pupil."status"='ENROLLED'
  JOIN LATERAL (SELECT r."action",r."visibility" FROM "FeeAccountRelease" r
    WHERE r."schoolId"=school."id" AND r."obligationId"=o."id" ORDER BY r."revision" DESC LIMIT 1) release ON true
  WHERE school."id"=p_school AND school."isActive" AND release."action"='PUBLISHED'
  -- Current enrollment permits a pupil to see an older term's released debt;
  -- promotion must not silently erase an outstanding financial obligation.
  AND EXISTS (SELECT 1 FROM "StudentEnrollment" enrollment
    JOIN "AcademicSession" session ON session."schoolId"=school."id" AND session."id"=enrollment."sessionId" AND session."status"='ACTIVE'
    JOIN "SchoolClass" classroom ON classroom."schoolId"=school."id" AND classroom."id"=enrollment."classId" AND classroom."isActive"
    JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=classroom."sectionId" AND section."isActive"
    WHERE enrollment."schoolId"=school."id" AND enrollment."studentId"=pupil."id" AND enrollment."status"='ACTIVE')
  AND (
    (member."role"='STUDENT' AND release."visibility" IN ('STUDENT_ONLY','STUDENT_AND_GUARDIAN')
      AND EXISTS (SELECT 1 FROM "StudentAccountLink" link
        WHERE link."schoolId"=school."id" AND link."studentId"=pupil."id" AND link."studentMembershipId"=member."id"
        AND NOT EXISTS (SELECT 1 FROM "StudentAccountLinkRevocation" revoked WHERE revoked."schoolId"=school."id" AND revoked."linkId"=link."id")))
    OR (member."role"='PARENT' AND release."visibility" IN ('GUARDIAN_ONLY','STUDENT_AND_GUARDIAN')
      AND EXISTS (SELECT 1 FROM "GuardianStudentLink" link
        WHERE link."schoolId"=school."id" AND link."studentId"=pupil."id" AND link."guardianMembershipId"=member."id"
        AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" revoked WHERE revoked."schoolId"=school."id" AND revoked."linkId"=link."id")))
  )
 );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE "FeeReceipt" (
 "id" TEXT PRIMARY KEY,
 "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
 "obligationId" TEXT NOT NULL,
 "allocationId" TEXT NOT NULL,
 "requestKey" UUID NOT NULL,
 "ordinal" INTEGER NOT NULL DEFAULT 1 CHECK ("ordinal">0),
 "receiptNumber" VARCHAR(32) NOT NULL DEFAULT '',
 "amountMinor" BIGINT NOT NULL DEFAULT 1 CHECK ("amountMinor">0 AND "amountMinor"<=1000000000000),
 "currency" VARCHAR(3) NOT NULL DEFAULT 'XXX' CHECK ("currency" ~ '^[A-Z]{3}$'),
 "snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "reason" VARCHAR(500) NOT NULL CHECK ("reason"=btrim("reason") AND length("reason") BETWEEN 5 AND 500),
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","id"), UNIQUE ("schoolId","allocationId"),
 UNIQUE ("schoolId","ordinal"), UNIQUE ("schoolId","receiptNumber"), UNIQUE ("schoolId","requestKey"),
 FOREIGN KEY ("schoolId","obligationId") REFERENCES "FeeObligation"("schoolId","id"),
 FOREIGN KEY ("schoolId","allocationId") REFERENCES "ManualPaymentAllocation"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);
CREATE FUNCTION "validate_fee_receipt"() RETURNS trigger AS $$
DECLARE source RECORD;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive" FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM "Membership" m
   WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."actorMembershipId"
    AND m."userId"=NEW."actorUserId" AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive") THEN
  RAISE EXCEPTION 'Current school receipt approver required' USING ERRCODE='23503';
 END IF;
 SELECT a."id",a."obligationId",a."amountMinor",a."currency",e."submitterUserId",
   school."name" AS "schoolName",pupil."givenName",pupil."familyName",pupil."admissionNumber",
   category."name" AS "categoryName",session."name" AS "sessionName",term."name" AS "termName"
 INTO source FROM "ManualPaymentAllocation" a
 JOIN "FeeObligation" o ON o."schoolId"=a."schoolId" AND o."id"=a."obligationId"
 JOIN "PaymentEvidence" e ON e."schoolId"=a."schoolId" AND e."id"=a."evidenceId" AND e."obligationId"=o."id"
 JOIN "PaymentVerificationDecision" d ON d."schoolId"=a."schoolId" AND d."id"=a."verificationId"
   AND d."evidenceId"=e."id" AND d."action"='VERIFIED' AND d."confirmedBankFunds"
   AND d."confirmedReferenceDigest"=e."referenceDigest"
 JOIN "School" school ON school."id"=o."schoolId"
 JOIN "StudentRecord" pupil ON pupil."schoolId"=o."schoolId" AND pupil."id"=o."studentId"
 JOIN "FeeCategory" category ON category."schoolId"=o."schoolId" AND category."id"=o."categoryId"
 JOIN "AcademicSession" session ON session."schoolId"=o."schoolId" AND session."id"=o."sessionId"
 JOIN "AcademicTerm" term ON term."schoolId"=o."schoolId" AND term."id"=o."termId"
 WHERE a."schoolId"=NEW."schoolId" AND a."id"=NEW."allocationId"
   AND a."amountMinor"=e."claimedAmountMinor" AND a."currency"=e."currency"
   AND NOT EXISTS (SELECT 1 FROM "ManualAllocationReversalRequest" r
     JOIN "ManualAllocationReversalDecision" reversed ON reversed."schoolId"=r."schoolId" AND reversed."requestId"=r."id" AND reversed."action"='APPROVED'
     WHERE r."schoolId"=a."schoolId" AND r."allocationId"=a."id");
 IF NOT FOUND OR source."submitterUserId"=NEW."actorUserId" THEN
  RAISE EXCEPTION 'Independent unreversed verified allocation required' USING ERRCODE='23503';
 END IF;
 SELECT COALESCE(max("ordinal"),0)+1 INTO NEW."ordinal" FROM "FeeReceipt" WHERE "schoolId"=NEW."schoolId";
 NEW."receiptNumber":='MSB-'||lpad(NEW."ordinal"::text,8,'0');
 NEW."obligationId":=source."obligationId";
 NEW."amountMinor":=source."amountMinor";
 NEW."currency":=source."currency";
 NEW."issuedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 NEW."snapshot":=jsonb_build_object('schoolName',source."schoolName",'givenName',source."givenName",
  'familyName',source."familyName",'admissionNumber',source."admissionNumber",'categoryName',source."categoryName",
  'sessionName',source."sessionName",'termName',source."termName",'provenance','INDEPENDENTLY_REVIEWED_MANUAL_ALLOCATION');
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "FeeReceipt_validate" BEFORE INSERT ON "FeeReceipt"
 FOR EACH ROW EXECUTE FUNCTION "validate_fee_receipt"();
CREATE TRIGGER "FeeReceipt_immutable" BEFORE UPDATE OR DELETE ON "FeeReceipt"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "FeeReceipt_no_truncate" BEFORE TRUNCATE ON "FeeReceipt"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Phase 8: immutable PRIVATE relationship eligibility review evidence only.
-- NEVER a report release, authorization grant, guardian acknowledgment, or
-- student/parent grade reader. P-004 and cumulative release gates are BLOCKED.
CREATE TABLE "ResultRecipientEligibilityEvidence" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "compositionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "recipientMembershipId" TEXT NOT NULL,
 "preflightId" TEXT NOT NULL DEFAULT '',
 "visibilityPolicyId" TEXT NOT NULL DEFAULT '',
 "visibilityPolicyVersion" INTEGER NOT NULL DEFAULT 0,
 "recipientRole" VARCHAR(16) NOT NULL DEFAULT 'INTERNAL_UNSET',
 "relationshipProofId" TEXT NOT NULL DEFAULT '',
 "status" VARCHAR(64) NOT NULL
   DEFAULT 'INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS',
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultRecipientEligibilityEvidence_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ResultRecipientEligibilityEvidence_valid_check" CHECK (
   char_length("preflightId")>0
   AND char_length("visibilityPolicyId")>0
   AND char_length("relationshipProofId")>0
   AND "visibilityPolicyVersion">=1
   AND "recipientRole" IN ('STUDENT','PARENT')
   AND "status"='INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS'
   AND char_length(btrim("reason")) BETWEEN 5 AND 500
   AND "reason"=btrim("reason"))
);
CREATE UNIQUE INDEX "ResultRecipientEligibilityEvidence_schoolId_id_key"
 ON "ResultRecipientEligibilityEvidence"("schoolId","id");
CREATE UNIQUE INDEX "ResultRecipientEligibilityEvidence_exact_proof_key"
 ON "ResultRecipientEligibilityEvidence"(
   "schoolId","compositionId","studentId","recipientMembershipId",
   "visibilityPolicyId","relationshipProofId");
CREATE INDEX "ResultRecipientEligibilityEvidence_schoolId_checkedAt_idx"
 ON "ResultRecipientEligibilityEvidence"("schoolId","checkedAt");
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_composition_fkey"
 FOREIGN KEY ("schoolId","compositionId")
 REFERENCES "PrivateOfficialReportComposition"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_student_fkey"
 FOREIGN KEY ("schoolId","studentId")
 REFERENCES "StudentRecord"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_recipient_fkey"
 FOREIGN KEY ("schoolId","recipientMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_preflight_fkey"
 FOREIGN KEY ("schoolId","preflightId")
 REFERENCES "ResultReleasePreflightAttestation"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_visibility_fkey"
 FOREIGN KEY ("schoolId","visibilityPolicyId")
 REFERENCES "ReportVisibilityPolicyRevision"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultRecipientEligibilityEvidence"
 ADD CONSTRAINT "ResultRecipientEligibilityEvidence_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_result_recipient_eligibility_evidence"()
 RETURNS trigger AS $$
DECLARE
 composition RECORD;
 visibility RECORD;
 prior_preflight RECORD;
 recipient RECORD;
 latest_guardian RECORD;
 proof_id TEXT;
 inspect_status TEXT;
BEGIN
 -- The same School row lock serializes the current policy and owner context.
 PERFORM 1 FROM "School" school
 WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Active school required' USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM "Membership" owner
   WHERE owner."schoolId"=NEW."schoolId"
     AND owner."id"=NEW."actorMembershipId"
     AND owner."userId"=NEW."actorUserId"
     AND owner."isActive"=true
     AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
   RAISE EXCEPTION 'Exact active School Super Admin required'
     USING ERRCODE='23503';
 END IF;
 -- Reuse the CURRENT locked academic readiness gate. An old private
 -- preflight never itself entitles a recipient to see marks.
 SELECT c."id",c."evidenceId",c."status",
   c."gradeScaleVersion",c."aggregationRuleVersion"
 INTO composition FROM "PrivateOfficialReportComposition" c
 WHERE c."schoolId"=NEW."schoolId" AND c."id"=NEW."compositionId";
 IF NOT FOUND OR composition."status" IS DISTINCT FROM
   'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED' THEN
   RAISE EXCEPTION 'Exact unreleased composition required'
     USING ERRCODE='23503';
 END IF;
 PERFORM "assert_result_publication_readiness"(
   NEW."schoolId",composition."evidenceId",
   NEW."actorMembershipId",NEW."actorUserId");
 IF composition."gradeScaleVersion" IS DISTINCT FROM (
     SELECT max(scale."version") FROM "ReportGradeScaleRevision" scale
     WHERE scale."schoolId"=NEW."schoolId"
   ) OR composition."aggregationRuleVersion" IS DISTINCT FROM (
     SELECT max(rule."version") FROM "ReportAggregationRuleRevision" rule
     WHERE rule."schoolId"=NEW."schoolId"
   ) THEN
   RAISE EXCEPTION 'Composed academic grading policy is no longer current'
     USING ERRCODE='23505';
 END IF;
 SELECT v."id",v."version",v."recipientMode" INTO visibility
 FROM "ReportVisibilityPolicyRevision" v
 WHERE v."schoolId"=NEW."schoolId"
 ORDER BY v."version" DESC LIMIT 1;
 IF NOT FOUND OR visibility."recipientMode" IS NULL
   OR visibility."recipientMode"='ASSESSMENT_ONLY' THEN
   RAISE EXCEPTION 'Explicit current report-recipient policy required'
     USING ERRCODE='23505';
 END IF;
 -- Require an existing immutable internal preflight for the EXACT report
 -- and CURRENT policy; never use its ID as an authorization token.
 SELECT p."id",p."visibilityPolicyId",p."visibilityPolicyVersion",p."status"
 INTO prior_preflight FROM "ResultReleasePreflightAttestation" p
 WHERE p."schoolId"=NEW."schoolId"
   AND p."compositionId"=NEW."compositionId"
   AND p."visibilityPolicyId"=visibility."id";
 IF NOT FOUND
   OR prior_preflight."visibilityPolicyVersion" IS DISTINCT FROM visibility."version"
   OR prior_preflight."status" IS DISTINCT FROM
     'INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION' THEN
   RAISE EXCEPTION 'Current exact private readiness evidence required'
     USING ERRCODE='23505';
 END IF;
 SELECT member."id",member."role" INTO recipient
 FROM "Membership" member
 JOIN "User" account ON account."id"=member."userId"
   AND account."emailVerified"=true
 WHERE member."schoolId"=NEW."schoolId"
   AND member."id"=NEW."recipientMembershipId"
   AND member."isActive"=true
   AND member."role" IN ('STUDENT','PARENT');
 IF NOT FOUND OR (
    recipient."role"='STUDENT' AND visibility."recipientMode"
    NOT IN ('STUDENT_AFTER_RELEASE','GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   ) OR (
    recipient."role"='PARENT' AND visibility."recipientMode"
    NOT IN ('GUARDIAN_AFTER_RELEASE','GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   ) THEN
   RAISE EXCEPTION 'Current adopted mode excludes proposed recipient'
     USING ERRCODE='23503';
 END IF;

 inspect_status:="inspect_private_report_recipient_relationship"(
   NEW."schoolId",NEW."compositionId",NEW."studentId",
   NEW."recipientMembershipId",NEW."actorMembershipId",NEW."actorUserId");
 IF inspect_status IS DISTINCT FROM 'RELATIONSHIP_VERIFIED_NOT_RELEASED' THEN
   RAISE EXCEPTION 'Current verified exact pupil recipient relationship required'
     USING ERRCODE='23505';
 END IF;
 IF recipient."role"='STUDENT' THEN
   SELECT link."id" INTO proof_id FROM "StudentAccountLink" link
   WHERE link."schoolId"=NEW."schoolId"
     AND link."studentId"=NEW."studentId"
     AND link."studentMembershipId"=NEW."recipientMembershipId"
     AND NOT EXISTS (
       SELECT 1 FROM "StudentAccountLinkRevocation" revoked
       WHERE revoked."schoolId"=link."schoolId" AND revoked."linkId"=link."id");
 ELSE
   SELECT event."id",event."action" INTO latest_guardian
   FROM "GuardianStudentRelationshipEvent" event
   WHERE event."schoolId"=NEW."schoolId"
     AND event."studentId"=NEW."studentId"
     AND event."guardianMembershipId"=NEW."recipientMembershipId"
   ORDER BY event."ordinal" DESC LIMIT 1;
   IF latest_guardian."action"='VERIFY' THEN
     proof_id:=latest_guardian."id";
   END IF;
 END IF;
 IF proof_id IS NULL OR char_length(proof_id)=0 THEN
   RAISE EXCEPTION 'Unrevoked exact relationship proof required'
     USING ERRCODE='23505';
 END IF;
 IF EXISTS (
   SELECT 1 FROM "ResultRecipientEligibilityEvidence" prior
   WHERE prior."schoolId"=NEW."schoolId"
     AND prior."compositionId"=NEW."compositionId"
     AND prior."studentId"=NEW."studentId"
     AND prior."recipientMembershipId"=NEW."recipientMembershipId"
     AND prior."visibilityPolicyId"=visibility."id"
     AND prior."relationshipProofId"=proof_id
 ) THEN
   RAISE EXCEPTION 'Exact relationship eligibility already audited'
     USING ERRCODE='23505';
 END IF;
 -- All sensitive recipient-proof and policy fields are DB-derived,
 -- immutable and NEVER a report read grant.
 NEW."preflightId":=prior_preflight."id";
 NEW."visibilityPolicyId":=visibility."id";
 NEW."visibilityPolicyVersion":=visibility."version";
 NEW."recipientRole":=recipient."role";
 NEW."relationshipProofId":=proof_id;
 NEW."status":='INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS';
 NEW."checkedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultRecipientEligibilityEvidence_validate"
 BEFORE INSERT ON "ResultRecipientEligibilityEvidence"
 FOR EACH ROW EXECUTE FUNCTION "validate_result_recipient_eligibility_evidence"();
CREATE TRIGGER "ResultRecipientEligibilityEvidence_immutable"
 BEFORE UPDATE OR DELETE ON "ResultRecipientEligibilityEvidence"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultRecipientEligibilityEvidence_no_truncate"
 BEFORE TRUNCATE ON "ResultRecipientEligibilityEvidence"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- Phase 8 internal release PRE-FLIGHT ONLY. NO official publication,
-- student/guardian read, recipient entitlement, report file or export.
-- Future release MUST independently recheck all conditions under School lock.
CREATE TABLE "ResultReleasePreflightAttestation" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "compositionId" TEXT NOT NULL, "visibilityPolicyId" TEXT NOT NULL,
 "visibilityPolicyVersion" INTEGER NOT NULL DEFAULT 1,
 "recipientMode" VARCHAR(48) NOT NULL,
 "evidenceId" TEXT NOT NULL, "finalDecisionId" TEXT NOT NULL,
 "sourcePacketId" TEXT NOT NULL, "studentCount" INTEGER NOT NULL DEFAULT 0,
 "status" VARCHAR(64) NOT NULL DEFAULT 'INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION',
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultReleasePreflightAttestation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ResultReleasePreflightAttestation_integrity_check" CHECK (
   "visibilityPolicyVersion">=1
   AND "studentCount" BETWEEN 1 AND 500
   AND "recipientMode" IN (
     'GUARDIAN_AFTER_RELEASE','STUDENT_AFTER_RELEASE',
     'GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   AND "status"='INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION'
   AND char_length(btrim("reason")) BETWEEN 5 AND 500
   AND "reason"=btrim("reason"))
);
CREATE UNIQUE INDEX "ResultReleasePreflightAttestation_schoolId_id_key"
 ON "ResultReleasePreflightAttestation"("schoolId","id");
CREATE UNIQUE INDEX "ResultReleasePreflightAttestation_schoolId_compositionId_visibilityPolicyId_key"
 ON "ResultReleasePreflightAttestation"("schoolId","compositionId","visibilityPolicyId");
CREATE INDEX "ResultReleasePreflightAttestation_schoolId_checkedAt_idx"
 ON "ResultReleasePreflightAttestation"("schoolId","checkedAt");
ALTER TABLE "ResultReleasePreflightAttestation"
 ADD CONSTRAINT "ResultReleasePreflightAttestation_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultReleasePreflightAttestation"
 ADD CONSTRAINT "ResultReleasePreflightAttestation_composition_fkey"
 FOREIGN KEY ("schoolId","compositionId")
 REFERENCES "PrivateOfficialReportComposition"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultReleasePreflightAttestation"
 ADD CONSTRAINT "ResultReleasePreflightAttestation_visibility_fkey"
 FOREIGN KEY ("schoolId","visibilityPolicyId")
 REFERENCES "ReportVisibilityPolicyRevision"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultReleasePreflightAttestation"
 ADD CONSTRAINT "ResultReleasePreflightAttestation_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_result_release_preflight_attestation"()
 RETURNS trigger AS $$
DECLARE
 composition RECORD;
 packet RECORD;
 decision RECORD;
 visibility RECORD;
 aggregation RECORD;
 scale RECORD;
 weights RECORD;
 recomputed JSONB;
BEGIN
 -- The existing strict source readiness predicate locks the active School
 -- and validates this exact current School Super Admin, original teacher,
 -- current independently verified HM/Principal, current adopted weights,
 -- complete pupil roster, and byte-equivalent frozen source manifest.
 SELECT comp."id",comp."sourcePacketId",comp."finalDecisionId",
   comp."evidenceId",comp."adoptionId",comp."sessionId",comp."termId",
   comp."classId",comp."subjectId",comp."evidenceRevision",
   comp."aggregationRuleId",comp."aggregationRuleVersion",
   comp."gradeScaleId",comp."gradeScaleVersion",
   comp."studentCount",comp."composedStudentCards",comp."status"
 INTO composition FROM "PrivateOfficialReportComposition" comp
 WHERE comp."schoolId"=NEW."schoolId" AND comp."id"=NEW."compositionId";
 IF NOT FOUND OR composition."status" IS DISTINCT FROM
     'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED' THEN
   RAISE EXCEPTION 'Exact non-released composition required'
     USING ERRCODE='23503';
 END IF;

 PERFORM "assert_result_publication_readiness"(
   NEW."schoolId",composition."evidenceId",
   NEW."actorMembershipId",NEW."actorUserId");

 SELECT packet."id",packet."finalDecisionId",packet."evidenceId",
   packet."adoptionId",packet."sessionId",packet."termId",
   packet."classId",packet."subjectId",packet."evidenceRevision",
   packet."studentCount",packet."studentSourceCards"
 INTO packet FROM "ResultReportCardSourcePacket" packet
 WHERE packet."schoolId"=NEW."schoolId"
   AND packet."id"=composition."sourcePacketId";
 IF NOT FOUND
   OR packet."finalDecisionId" IS DISTINCT FROM composition."finalDecisionId"
   OR packet."evidenceId" IS DISTINCT FROM composition."evidenceId"
   OR packet."adoptionId" IS DISTINCT FROM composition."adoptionId"
   OR packet."sessionId" IS DISTINCT FROM composition."sessionId"
   OR packet."termId" IS DISTINCT FROM composition."termId"
   OR packet."classId" IS DISTINCT FROM composition."classId"
   OR packet."subjectId" IS DISTINCT FROM composition."subjectId"
   OR packet."evidenceRevision" IS DISTINCT FROM composition."evidenceRevision"
   OR packet."studentCount" IS DISTINCT FROM composition."studentCount" THEN
   RAISE EXCEPTION 'Exact current frozen packet and composition must agree'
     USING ERRCODE='23505';
 END IF;
 SELECT d."id",d."status",d."evidenceId",d."adoptionId",
   d."sessionId",d."termId",d."classId",d."subjectId",
   d."evidenceRevision" INTO decision
 FROM "ResultFinalPublicationDecision" d
 WHERE d."schoolId"=NEW."schoolId"
   AND d."id"=composition."finalDecisionId";
 IF NOT FOUND
   OR decision."status" IS DISTINCT FROM 'APPROVED_AWAITING_RELEASE'
   OR decision."evidenceId" IS DISTINCT FROM composition."evidenceId"
   OR decision."adoptionId" IS DISTINCT FROM composition."adoptionId"
   OR decision."sessionId" IS DISTINCT FROM composition."sessionId"
   OR decision."termId" IS DISTINCT FROM composition."termId"
   OR decision."classId" IS DISTINCT FROM composition."classId"
   OR decision."subjectId" IS DISTINCT FROM composition."subjectId"
   OR decision."evidenceRevision" IS DISTINCT FROM composition."evidenceRevision"
 THEN
   RAISE EXCEPTION 'Exact prior independent owner decision required'
     USING ERRCODE='23505';
 END IF;

 -- Four school-configurable options exist, but ASSESSMENT_ONLY explicitly
 -- disables *report recipients*. This preflight rejects it, rather than
 -- suggesting that private CBT access implies report-card access.
 SELECT p."id",p."version",p."recipientMode" INTO visibility
 FROM "ReportVisibilityPolicyRevision" p
 WHERE p."schoolId"=NEW."schoolId"
   AND p."id"=NEW."visibilityPolicyId";
 IF NOT FOUND OR visibility."version" IS DISTINCT FROM (
   SELECT max(v."version") FROM "ReportVisibilityPolicyRevision" v
   WHERE v."schoolId"=NEW."schoolId")
   OR visibility."recipientMode" IS NULL
   OR visibility."recipientMode"='ASSESSMENT_ONLY' THEN
   RAISE EXCEPTION 'Current explicitly adopted recipient mode required'
     USING ERRCODE='23505';
 END IF;

 -- A newly adopted category method or school grade scale makes an earlier
 -- private composition stale even if the underlying marks have not changed.
 SELECT a."id",a."version",a."categoryMethod",a."precisionMode"
 INTO aggregation FROM "ReportAggregationRuleRevision" a
 WHERE a."schoolId"=NEW."schoolId" AND a."id"=composition."aggregationRuleId";
 IF NOT FOUND
   OR aggregation."version" IS DISTINCT FROM composition."aggregationRuleVersion"
   OR aggregation."version" IS DISTINCT FROM (
      SELECT max(a2."version") FROM "ReportAggregationRuleRevision" a2
      WHERE a2."schoolId"=NEW."schoolId") THEN
   RAISE EXCEPTION 'Composed category formula is no longer current'
     USING ERRCODE='23505';
 END IF;
 SELECT g."id",g."version",g."bands",g."decimalPlaces",
   g."roundingMode",g."bandBasis" INTO scale
 FROM "ReportGradeScaleRevision" g
 WHERE g."schoolId"=NEW."schoolId" AND g."id"=composition."gradeScaleId";
 IF NOT FOUND
   OR scale."version" IS DISTINCT FROM composition."gradeScaleVersion"
   OR scale."version" IS DISTINCT FROM (
      SELECT max(g2."version") FROM "ReportGradeScaleRevision" g2
      WHERE g2."schoolId"=NEW."schoolId") THEN
   RAISE EXCEPTION 'Composed grading scale is no longer current'
     USING ERRCODE='23505';
 END IF;
 SELECT policy."version",policy."quizWeight",
   policy."testWeight",policy."examWeight" INTO weights
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" policy
  ON policy."schoolId"=adoption."schoolId" AND policy."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
  AND adoption."id"=composition."adoptionId";
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Adopted assessment weights missing'
     USING ERRCODE='23503';
 END IF;
 recomputed:="build_private_official_report_cards"(
   packet."studentSourceCards",packet."studentCount",
   weights."version",weights."quizWeight",weights."testWeight",
   weights."examWeight",aggregation."categoryMethod",
   aggregation."precisionMode",scale."bands",scale."decimalPlaces",
   scale."roundingMode",scale."bandBasis");
 IF recomputed IS DISTINCT FROM composition."composedStudentCards" THEN
   RAISE EXCEPTION 'Frozen official composition no longer matches current calculation'
     USING ERRCODE='23505';
 END IF;

 IF EXISTS (
   SELECT 1 FROM "ResultReleasePreflightAttestation" earlier
   WHERE earlier."schoolId"=NEW."schoolId"
     AND earlier."compositionId"=NEW."compositionId"
     AND earlier."visibilityPolicyId"=NEW."visibilityPolicyId"
 ) THEN
   RAISE EXCEPTION 'Internal preflight already recorded for exact policy and composition'
     USING ERRCODE='23505';
 END IF;

 -- Never trust caller-selected mode, policy version, decision/evidence,
 -- roster count, result data, release status or timestamp.
 NEW."visibilityPolicyVersion":=visibility."version";
 NEW."recipientMode":=visibility."recipientMode";
 NEW."evidenceId":=composition."evidenceId";
 NEW."finalDecisionId":=composition."finalDecisionId";
 NEW."sourcePacketId":=composition."sourcePacketId";
 NEW."studentCount":=composition."studentCount";
 NEW."status":='INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION';
 NEW."checkedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultReleasePreflightAttestation_validate"
 BEFORE INSERT ON "ResultReleasePreflightAttestation"
 FOR EACH ROW EXECUTE FUNCTION "validate_result_release_preflight_attestation"();
CREATE TRIGGER "ResultReleasePreflightAttestation_immutable"
 BEFORE UPDATE OR DELETE ON "ResultReleasePreflightAttestation"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultReleasePreflightAttestation_no_truncate"
 BEFORE TRUNCATE ON "ResultReleasePreflightAttestation"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

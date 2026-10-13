-- Phase 8 final result release protocol (development candidate only).
-- No implicit publication from academic approval or private composition.
-- No school visibility policy => no release. Distinct audited owner action.
CREATE TYPE "ReportVisibilityMode" AS ENUM
 ('SCHOOL_ONLY','STUDENT_ONLY','GUARDIAN_ONLY','GUARDIAN_FIRST_ACK');

CREATE TABLE "ReportVisibilityPolicyRevision" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1,
 "mode" "ReportVisibilityMode" NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportVisibilityPolicyRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReportVisibilityPolicyRevision_check" CHECK (
  "version" BETWEEN 1 AND 1000000
  AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ReportVisibilityPolicyRevision_schoolId_id_key"
 ON "ReportVisibilityPolicyRevision"("schoolId","id");
CREATE UNIQUE INDEX "ReportVisibilityPolicyRevision_schoolId_version_key"
 ON "ReportVisibilityPolicyRevision"("schoolId","version");
ALTER TABLE "ReportVisibilityPolicyRevision" ADD CONSTRAINT
 "ReportVisibilityPolicyRevision_schoolId_fkey" FOREIGN KEY ("schoolId")
 REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportVisibilityPolicyRevision" ADD CONSTRAINT
 "ReportVisibilityPolicyRevision_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_report_visibility_policy"() RETURNS trigger AS $$
DECLARE previous_version INTEGER;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId"
  AND "isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current active school required for report policy'
   USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "Membership" owner
  WHERE owner."schoolId"=NEW."schoolId"
   AND owner."id"=NEW."actorMembershipId"
   AND owner."userId"=NEW."actorUserId"
   AND owner."isActive"=true AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
  RAISE EXCEPTION 'Current exact school owner required for visibility'
   USING ERRCODE='23503';
 END IF;
 SELECT coalesce(max(p."version"),0) INTO previous_version
 FROM "ReportVisibilityPolicyRevision" p
 WHERE p."schoolId"=NEW."schoolId";
 IF previous_version>=1000000 THEN
  RAISE EXCEPTION 'Report visibility revision limit reached'
   USING ERRCODE='23514';
 END IF;
 NEW."version":=previous_version+1;
 NEW."adoptedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportVisibilityPolicyRevision_validate"
 BEFORE INSERT ON "ReportVisibilityPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_visibility_policy"();

CREATE TABLE "ReportRecipientRelease" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "compositionId" TEXT NOT NULL, "visibilityPolicyId" TEXT NOT NULL,
 "visibilityPolicyVersion" INTEGER NOT NULL DEFAULT 1,
 "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
 "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "releaseOrdinal" INTEGER NOT NULL DEFAULT 1,
 "studentCount" INTEGER NOT NULL DEFAULT 0,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportRecipientRelease_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReportRecipientRelease_check" CHECK (
  "visibilityPolicyVersion" BETWEEN 1 AND 1000000
  AND "releaseOrdinal" BETWEEN 1 AND 1000000
  AND "studentCount" BETWEEN 1 AND 500
  AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ReportRecipientRelease_schoolId_id_key"
 ON "ReportRecipientRelease"("schoolId","id");
CREATE UNIQUE INDEX "ReportRecipientRelease_composition_policy_key"
 ON "ReportRecipientRelease"("schoolId","compositionId","visibilityPolicyId");
CREATE UNIQUE INDEX "ReportRecipientRelease_exact_ordinal_key"
 ON "ReportRecipientRelease"("schoolId","sessionId","termId",
   "classId","subjectId","releaseOrdinal");
CREATE INDEX "ReportRecipientRelease_school_context_time_idx"
 ON "ReportRecipientRelease"("schoolId","sessionId","termId",
   "classId","releasedAt");
ALTER TABLE "ReportRecipientRelease" ADD CONSTRAINT
 "ReportRecipientRelease_schoolId_fkey" FOREIGN KEY ("schoolId")
 REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportRecipientRelease" ADD CONSTRAINT
 "ReportRecipientRelease_composition_fkey"
 FOREIGN KEY ("schoolId","compositionId")
 REFERENCES "PrivateOfficialReportComposition"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ReportRecipientRelease" ADD CONSTRAINT
 "ReportRecipientRelease_visibility_fkey"
 FOREIGN KEY ("schoolId","visibilityPolicyId")
 REFERENCES "ReportVisibilityPolicyRevision"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ReportRecipientRelease" ADD CONSTRAINT
 "ReportRecipientRelease_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

-- The owner must release this exact immutable composition after fresh
-- source/teacher/section-review/policy/roster checks IN THIS INSERT.
-- Historical release rows survive later approved corrections; only the latest
-- context ordinal can be served to a recipient.
CREATE FUNCTION "validate_report_recipient_release"() RETURNS trigger AS $$
DECLARE
 snapshot RECORD;
 school_policy RECORD;
 scale RECORD;
 aggregation RECORD;
 weighting RECORD;
 packet RECORD;
 recalculated JSONB;
 last_ordinal INTEGER;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId"
  AND "isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Active school needed for report release'
   USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "Membership" owner WHERE owner."schoolId"=NEW."schoolId"
   AND owner."id"=NEW."actorMembershipId"
   AND owner."userId"=NEW."actorUserId"
   AND owner."isActive"=true AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
  RAISE EXCEPTION 'Current school super admin release required'
   USING ERRCODE='23503';
 END IF;
 SELECT c.* INTO snapshot
 FROM "PrivateOfficialReportComposition" c
 WHERE c."schoolId"=NEW."schoolId" AND c."id"=NEW."compositionId"
  AND c."status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Exact complete frozen official composition required'
   USING ERRCODE='23503';
 END IF;
 SELECT policy.* INTO school_policy
 FROM "ReportVisibilityPolicyRevision" policy
 WHERE policy."schoolId"=NEW."schoolId"
  AND policy."id"=NEW."visibilityPolicyId"
  AND policy."version"=(
    SELECT max(v."version") FROM "ReportVisibilityPolicyRevision" v
    WHERE v."schoolId"=NEW."schoolId");
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Explicit latest adopted visibility policy required'
   USING ERRCODE='23505';
 END IF;
 -- Always rerun full teacher/current source/verified reviewer and school
 -- owner readiness even though the composition was previously frozen.
 PERFORM "assert_result_publication_readiness"(
  NEW."schoolId",snapshot."evidenceId",
  NEW."actorMembershipId",NEW."actorUserId");
 SELECT p.* INTO packet FROM "ResultReportCardSourcePacket" p
 WHERE p."schoolId"=NEW."schoolId" AND p."id"=snapshot."sourcePacketId"
  AND p."finalDecisionId"=snapshot."finalDecisionId"
  AND p."evidenceId"=snapshot."evidenceId"
  AND p."adoptionId"=snapshot."adoptionId"
  AND p."studentCount"=snapshot."studentCount";
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Frozen complete approved source packet missing'
   USING ERRCODE='23503';
 END IF;
 SELECT g.* INTO scale FROM "ReportGradeScaleRevision" g
 WHERE g."schoolId"=NEW."schoolId" AND g."id"=snapshot."gradeScaleId"
  AND g."version"=snapshot."gradeScaleVersion"
  AND g."version"=(
    SELECT max(x."version") FROM "ReportGradeScaleRevision" x
    WHERE x."schoolId"=NEW."schoolId");
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Composed grade scale is no longer current'
   USING ERRCODE='23505';
 END IF;
 SELECT a.* INTO aggregation FROM "ReportAggregationRuleRevision" a
 WHERE a."schoolId"=NEW."schoolId" AND a."id"=snapshot."aggregationRuleId"
  AND a."version"=snapshot."aggregationRuleVersion"
  AND a."version"=(
    SELECT max(x."version") FROM "ReportAggregationRuleRevision" x
    WHERE x."schoolId"=NEW."schoolId");
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Composed aggregation is no longer current'
   USING ERRCODE='23505';
 END IF;
 SELECT weighting_rule."version",weighting_rule."quizWeight",
  weighting_rule."testWeight",weighting_rule."examWeight"
 INTO weighting FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" weighting_rule
 ON weighting_rule."schoolId"=adoption."schoolId"
 AND weighting_rule."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
  AND adoption."id"=snapshot."adoptionId";
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Adopted weighting of composed source missing'
   USING ERRCODE='23503';
 END IF;
 recalculated:="build_private_official_report_cards"(
  packet."studentSourceCards",packet."studentCount",
  weighting."version",weighting."quizWeight",weighting."testWeight",
  weighting."examWeight",aggregation."categoryMethod",
  aggregation."precisionMode",scale."bands",scale."decimalPlaces",
  scale."roundingMode",scale."bandBasis");
 IF recalculated IS DISTINCT FROM snapshot."composedStudentCards" THEN
  RAISE EXCEPTION 'Frozen official grades do not match trusted source'
   USING ERRCODE='23505';
 END IF;
 SELECT coalesce(max(r."releaseOrdinal"),0) INTO last_ordinal
 FROM "ReportRecipientRelease" r
 WHERE r."schoolId"=NEW."schoolId"
  AND r."sessionId"=snapshot."sessionId"
  AND r."termId"=snapshot."termId"
  AND r."classId"=snapshot."classId"
  AND r."subjectId"=snapshot."subjectId";
 IF last_ordinal>=1000000 THEN
  RAISE EXCEPTION 'Report release version limit reached'
   USING ERRCODE='23514';
 END IF;
 NEW."sessionId":=snapshot."sessionId";
 NEW."termId":=snapshot."termId";
 NEW."classId":=snapshot."classId";
 NEW."subjectId":=snapshot."subjectId";
 NEW."studentCount":=snapshot."studentCount";
 NEW."visibilityPolicyVersion":=school_policy."version";
 NEW."releaseOrdinal":=last_ordinal+1;
 NEW."releasedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportRecipientRelease_validate"
 BEFORE INSERT ON "ReportRecipientRelease"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_recipient_release"();

CREATE TABLE "ReportGuardianAcknowledgment" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "releaseId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "guardianLinkId" TEXT NOT NULL, "guardianMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportGuardianAcknowledgment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportGuardianAcknowledgment_schoolId_id_key"
 ON "ReportGuardianAcknowledgment"("schoolId","id");
CREATE UNIQUE INDEX "ReportGuardianAcknowledgment_exact_receipt_key"
 ON "ReportGuardianAcknowledgment"("schoolId","releaseId","studentId","guardianMembershipId");
CREATE INDEX "ReportGuardianAcknowledgment_schoolId_studentId_acknowledgedAt_idx"
 ON "ReportGuardianAcknowledgment"("schoolId","studentId","acknowledgedAt");
ALTER TABLE "ReportGuardianAcknowledgment" ADD CONSTRAINT
 "ReportGuardianAcknowledgment_schoolId_fkey" FOREIGN KEY ("schoolId")
 REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportGuardianAcknowledgment" ADD CONSTRAINT
 "ReportGuardianAcknowledgment_release_fkey" FOREIGN KEY ("schoolId","releaseId")
 REFERENCES "ReportRecipientRelease"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ReportGuardianAcknowledgment" ADD CONSTRAINT
 "ReportGuardianAcknowledgment_student_fkey" FOREIGN KEY ("schoolId","studentId")
 REFERENCES "StudentRecord"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ReportGuardianAcknowledgment" ADD CONSTRAINT
 "ReportGuardianAcknowledgment_link_fkey" FOREIGN KEY ("schoolId","guardianLinkId")
 REFERENCES "GuardianStudentLink"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ReportGuardianAcknowledgment" ADD CONSTRAINT
 "ReportGuardianAcknowledgment_guardian_fkey"
 FOREIGN KEY ("schoolId","guardianMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_report_guardian_acknowledgment"() RETURNS trigger AS $$
DECLARE selected_release RECORD;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId"
  AND "isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Active school needed for guardian report acknowledgment'
   USING ERRCODE='23503';
 END IF;
 SELECT r.* INTO selected_release FROM "ReportRecipientRelease" r
 JOIN "ReportVisibilityPolicyRevision" policy
 ON policy."schoolId"=r."schoolId"
 AND policy."id"=r."visibilityPolicyId"
 WHERE r."schoolId"=NEW."schoolId" AND r."id"=NEW."releaseId"
  AND policy."mode"='GUARDIAN_FIRST_ACK'
  AND policy."version"=(
   SELECT max(v."version") FROM "ReportVisibilityPolicyRevision" v
   WHERE v."schoolId"=NEW."schoolId")
  AND NOT EXISTS (SELECT 1 FROM "ReportRecipientRelease" newer
   WHERE newer."schoolId"=r."schoolId"
    AND newer."sessionId"=r."sessionId" AND newer."termId"=r."termId"
    AND newer."classId"=r."classId" AND newer."subjectId"=r."subjectId"
    AND newer."releaseOrdinal">r."releaseOrdinal");
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current guardian-first published version required'
   USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "GuardianStudentLink" link
  JOIN "Membership" guardian ON guardian."schoolId"=link."schoolId"
    AND guardian."id"=link."guardianMembershipId"
  JOIN "StudentRecord" child ON child."schoolId"=link."schoolId"
    AND child."id"=link."studentId" AND child."status"='ENROLLED'
  JOIN "StudentEnrollment" e ON e."schoolId"=child."schoolId"
    AND e."studentId"=child."id" AND e."sessionId"=selected_release."sessionId"
    AND e."classId"=selected_release."classId" AND e."status"='ACTIVE'
  JOIN "PrivateOfficialReportComposition" c ON c."schoolId"=link."schoolId"
    AND c."id"=selected_release."compositionId"
  WHERE link."schoolId"=NEW."schoolId"
    AND link."id"=NEW."guardianLinkId"
    AND link."studentId"=NEW."studentId"
    AND link."guardianMembershipId"=NEW."guardianMembershipId"
    AND guardian."userId"=NEW."actorUserId"
    AND guardian."role"='PARENT' AND guardian."isActive"=true
    AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" revoked
      WHERE revoked."schoolId"=link."schoolId" AND revoked."linkId"=link."id")
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(c."composedStudentCards") AS card
      WHERE card->>'studentId'=child."id"
       AND card->>'reportStatus'='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED')
 ) THEN
  RAISE EXCEPTION 'Independent current exact guardian-child access required'
   USING ERRCODE='23503';
 END IF;
 NEW."acknowledgedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportGuardianAcknowledgment_validate"
 BEFORE INSERT ON "ReportGuardianAcknowledgment"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_guardian_acknowledgment"();

-- Audit histories are never revised or deleted to "unpublish" a child.
-- Current policy and latest release ordinal control recipient eligibility.
CREATE TRIGGER "ReportVisibilityPolicyRevision_immutable"
 BEFORE UPDATE OR DELETE ON "ReportVisibilityPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "ReportRecipientRelease_immutable"
 BEFORE UPDATE OR DELETE ON "ReportRecipientRelease"
 FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "ReportGuardianAcknowledgment_immutable"
 BEFORE UPDATE OR DELETE ON "ReportGuardianAcknowledgment"
 FOR EACH ROW EXECUTE FUNCTION "prevent_attendance_history_mutation"();
CREATE TRIGGER "ReportVisibilityPolicyRevision_no_truncate"
 BEFORE TRUNCATE ON "ReportVisibilityPolicyRevision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "ReportRecipientRelease_no_truncate"
 BEFORE TRUNCATE ON "ReportRecipientRelease"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();
CREATE TRIGGER "ReportGuardianAcknowledgment_no_truncate"
 BEFORE TRUNCATE ON "ReportGuardianAcknowledgment"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_attendance_truncate"();

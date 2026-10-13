-- Phase 8 private school-owner preview of exactly ONE pupil's approved,
-- recomputed grade. NO student/guardian report access, publication or export.
-- Viewing is POST-only, logged in immutable metadata-only audit history.
CREATE TABLE "ResultPrivateGradePreviewAudit" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "compositionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "evidenceRevision" INTEGER NOT NULL DEFAULT 0,
 "status" VARCHAR(64) NOT NULL DEFAULT 'INTERNAL_OWNER_PREVIEW_NOT_RELEASED',
 "reason" VARCHAR(500) NOT NULL,
 "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultPrivateGradePreviewAudit_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ResultPrivateGradePreviewAudit_content_check" CHECK (
   "evidenceRevision">=1
   AND "status"='INTERNAL_OWNER_PREVIEW_NOT_RELEASED'
   AND char_length(btrim("reason")) BETWEEN 5 AND 500
   AND "reason"=btrim("reason"))
);
CREATE UNIQUE INDEX "ResultPrivateGradePreviewAudit_schoolId_id_key"
 ON "ResultPrivateGradePreviewAudit"("schoolId","id");
CREATE INDEX "ResultPrivateGradePreviewAudit_schoolId_viewedAt_idx"
 ON "ResultPrivateGradePreviewAudit"("schoolId","viewedAt");
ALTER TABLE "ResultPrivateGradePreviewAudit"
 ADD CONSTRAINT "ResultPrivateGradePreviewAudit_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultPrivateGradePreviewAudit"
 ADD CONSTRAINT "ResultPrivateGradePreviewAudit_composition_fkey"
 FOREIGN KEY ("schoolId","compositionId")
 REFERENCES "PrivateOfficialReportComposition"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultPrivateGradePreviewAudit"
 ADD CONSTRAINT "ResultPrivateGradePreviewAudit_student_fkey"
 FOREIGN KEY ("schoolId","studentId")
 REFERENCES "StudentRecord"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultPrivateGradePreviewAudit"
 ADD CONSTRAINT "ResultPrivateGradePreviewAudit_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

-- SECURITY INVOKER (the PostgreSQL default); never SECURITY DEFINER.
-- All body operations are in the same SERIALIZABLE school-locked transaction
-- as the audit insertion. Full classroom grade JSON remains inside the DB.
CREATE FUNCTION "read_private_owner_one_pupil_grade_preview"(
 p_school TEXT,p_composition TEXT,p_student TEXT,
 p_owner_membership TEXT,p_owner_user TEXT,
 p_audit_id TEXT,p_audit_reason TEXT
) RETURNS JSONB AS $$
DECLARE
 comp RECORD;
 packet RECORD;
 scale RECORD;
 aggregation RECORD;
 weights RECORD;
 pupil RECORD;
 recomputed JSONB;
 matching JSONB;
 grade JSONB;
 audit_row RECORD;
BEGIN
 SELECT c."schoolId",c."evidenceId",c."sourcePacketId",
   c."adoptionId",c."sessionId",c."termId",c."classId",c."subjectId",
   c."evidenceRevision",c."studentCount",c."status",
   c."aggregationRuleId",c."aggregationRuleVersion",
   c."gradeScaleId",c."gradeScaleVersion",c."composedStudentCards"
 INTO comp FROM "PrivateOfficialReportComposition" c
 WHERE c."schoolId"=p_school AND c."id"=p_composition
   AND c."status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED';
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Private composition not found' USING ERRCODE='23503';
 END IF;
 -- Recheck CURRENT school owner, exact TEACHER assignment, independent
 -- verified HM/Principal section reviewer, latest adopted weights,
 -- complete enrolled roster and immutable source fingerprint.
 PERFORM "assert_result_publication_readiness"(
   p_school,comp."evidenceId",p_owner_membership,p_owner_user);

 SELECT a."version",a."categoryMethod",a."precisionMode"
 INTO aggregation FROM "ReportAggregationRuleRevision" a
 WHERE a."schoolId"=p_school AND a."id"=comp."aggregationRuleId";
 IF NOT FOUND OR aggregation."version" IS DISTINCT FROM
   comp."aggregationRuleVersion"
   OR aggregation."version" IS DISTINCT FROM (
     SELECT max(a2."version") FROM "ReportAggregationRuleRevision" a2
     WHERE a2."schoolId"=p_school) THEN
   RAISE EXCEPTION 'Current adopted report aggregation required'
     USING ERRCODE='23505';
 END IF;
 SELECT g."version",g."bands",g."decimalPlaces",g."roundingMode",
   g."bandBasis" INTO scale
 FROM "ReportGradeScaleRevision" g
 WHERE g."schoolId"=p_school AND g."id"=comp."gradeScaleId";
 IF NOT FOUND OR scale."version" IS DISTINCT FROM
   comp."gradeScaleVersion"
   OR scale."version" IS DISTINCT FROM (
     SELECT max(g2."version") FROM "ReportGradeScaleRevision" g2
     WHERE g2."schoolId"=p_school) THEN
   RAISE EXCEPTION 'Current adopted report grading scale required'
     USING ERRCODE='23505';
 END IF;
 SELECT source."schoolId",source."evidenceId",source."adoptionId",
   source."sessionId",source."termId",source."classId",source."subjectId",
   source."evidenceRevision",source."studentCount",source."studentSourceCards"
 INTO packet FROM "ResultReportCardSourcePacket" source
 WHERE source."schoolId"=p_school AND source."id"=comp."sourcePacketId";
 IF NOT FOUND
   OR packet."evidenceId" IS DISTINCT FROM comp."evidenceId"
   OR packet."adoptionId" IS DISTINCT FROM comp."adoptionId"
   OR packet."sessionId" IS DISTINCT FROM comp."sessionId"
   OR packet."termId" IS DISTINCT FROM comp."termId"
   OR packet."classId" IS DISTINCT FROM comp."classId"
   OR packet."subjectId" IS DISTINCT FROM comp."subjectId"
   OR packet."evidenceRevision" IS DISTINCT FROM comp."evidenceRevision"
   OR packet."studentCount" IS DISTINCT FROM comp."studentCount" THEN
   RAISE EXCEPTION 'Exact frozen source and report must agree'
     USING ERRCODE='23505';
 END IF;
 SELECT policy."version",policy."quizWeight",policy."testWeight",
   policy."examWeight" INTO weights
 FROM "ResultGradingAdoption" adopted
 JOIN "AssessmentGradingPolicyRevision" policy
   ON policy."schoolId"=adopted."schoolId"
   AND policy."id"=adopted."policyId"
 WHERE adopted."schoolId"=p_school AND adopted."id"=comp."adoptionId";
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Adopted assessment weighting is missing'
     USING ERRCODE='23503';
 END IF;
 recomputed:="build_private_official_report_cards"(
   packet."studentSourceCards",packet."studentCount",
   weights."version",weights."quizWeight",weights."testWeight",
   weights."examWeight",aggregation."categoryMethod",
   aggregation."precisionMode",scale."bands",scale."decimalPlaces",
   scale."roundingMode",scale."bandBasis");
 IF recomputed IS DISTINCT FROM comp."composedStudentCards" THEN
   RAISE EXCEPTION 'Historical grade composition parity failure'
     USING ERRCODE='23505';
 END IF;
 SELECT stu."givenName",stu."familyName",stu."admissionNumber",
   school."name" AS "schoolName",classroom."name" AS "className",
   subject."name" AS "subjectName",academic_session."name" AS "sessionName",
   term."name" AS "termName" INTO pupil
 FROM "StudentRecord" stu
 JOIN "School" school ON school."id"=stu."schoolId"
 JOIN "StudentEnrollment" enrolled
   ON enrolled."schoolId"=stu."schoolId"
   AND enrolled."studentId"=stu."id"
   AND enrolled."classId"=comp."classId"
   AND enrolled."sessionId"=comp."sessionId"
   AND enrolled."status"='ACTIVE'
 JOIN "SchoolClass" classroom
   ON classroom."schoolId"=stu."schoolId"
   AND classroom."id"=enrolled."classId"
 JOIN "Subject" subject
   ON subject."schoolId"=stu."schoolId"
   AND subject."id"=comp."subjectId"
 JOIN "AcademicSession" academic_session
   ON academic_session."schoolId"=stu."schoolId"
   AND academic_session."id"=comp."sessionId"
 JOIN "AcademicTerm" term
   ON term."schoolId"=stu."schoolId"
   AND term."id"=comp."termId"
   AND term."sessionId"=academic_session."id"
 WHERE stu."schoolId"=p_school AND stu."id"=p_student
   AND stu."status"='ENROLLED';
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Exact currently enrolled pupil required'
     USING ERRCODE='23503';
 END IF;
 SELECT jsonb_agg(card.value) INTO matching
 FROM jsonb_array_elements(recomputed) AS card(value)
 WHERE card.value->>'studentId'=p_student;
 IF jsonb_typeof(matching) IS DISTINCT FROM 'array'
    OR jsonb_array_length(matching)<>1 THEN
   RAISE EXCEPTION 'Exactly one approved private pupil grade required'
     USING ERRCODE='23505';
 END IF;
 grade:=matching->0;
 -- The grade result cannot be returned without successfully recording its
 -- own immutable audit. A direct SQL invocation is audited as well; the
 -- application must commit this same transaction before sending the result.
 INSERT INTO "ResultPrivateGradePreviewAudit" (
   "id","schoolId","compositionId","studentId",
   "actorMembershipId","actorUserId","reason"
 ) VALUES (
   p_audit_id,p_school,p_composition,p_student,
   p_owner_membership,p_owner_user,p_audit_reason
 ) RETURNING "id","evidenceRevision","viewedAt","status" INTO audit_row;
 -- Explicit allowlist. No classmates, source JSON, correction details,
 -- answer keys or downloaded report, even when invoked directly via SQL.
 RETURN jsonb_build_object(
   'preview',jsonb_build_object(
   'status','PRIVATE_OWNER_PREVIEW_NOT_RELEASED',
   'student',jsonb_build_object(
      'givenName',pupil."givenName",'familyName',pupil."familyName",
      'admissionNumber',pupil."admissionNumber"),
   'schoolName',pupil."schoolName",
   'academic',jsonb_build_object(
      'session',pupil."sessionName",'term',pupil."termName",
      'class',pupil."className",'subject',pupil."subjectName"),
   'assessmentWeights',jsonb_build_object(
      'QUIZ',weights."quizWeight",
      'TEST',weights."testWeight",
      'EXAM',weights."examWeight"),
   'categoryPercentBps',grade->'categoryPercentBps',
   'rawPercentBps',grade->'rawPercentBps',
   'displayPercent',grade->'displayPercent',
   'gradeCode',grade->'gradeCode',
   'remark',grade->'remark',
   'evidenceRevision',comp."evidenceRevision",
   'gradeScaleVersion',comp."gradeScaleVersion",
   'aggregationRuleVersion',comp."aggregationRuleVersion"),
   'audit',jsonb_build_object(
      'id',audit_row."id",
      'evidenceRevision',audit_row."evidenceRevision",
      'status',audit_row."status",
      'viewedAt',audit_row."viewedAt"));
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE FUNCTION "validate_private_grade_preview_audit"()
 RETURNS trigger AS $$
DECLARE
 snapshot RECORD;
BEGIN
 PERFORM 1 FROM "School" school
 WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM "Membership" owner
   WHERE owner."schoolId"=NEW."schoolId"
     AND owner."id"=NEW."actorMembershipId"
     AND owner."userId"=NEW."actorUserId"
     AND owner."isActive"=true
     AND owner."role"='SCHOOL_SUPER_ADMIN') THEN
   RAISE EXCEPTION 'Current exact School Super Admin required'
     USING ERRCODE='23503';
 END IF;
 SELECT comp."evidenceRevision",comp."status",comp."classId",
   comp."sessionId",comp."composedStudentCards" INTO snapshot
 FROM "PrivateOfficialReportComposition" comp
 WHERE comp."schoolId"=NEW."schoolId"
   AND comp."id"=NEW."compositionId";
 IF NOT FOUND OR snapshot."status" IS DISTINCT FROM
    'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED' THEN
   RAISE EXCEPTION 'Internal unreleased grade evidence required'
     USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM "StudentRecord" student
   JOIN "StudentEnrollment" enrollment
     ON enrollment."schoolId"=student."schoolId"
     AND enrollment."studentId"=student."id"
     AND enrollment."sessionId"=snapshot."sessionId"
     AND enrollment."classId"=snapshot."classId"
     AND enrollment."status"='ACTIVE'
   WHERE student."schoolId"=NEW."schoolId"
     AND student."id"=NEW."studentId"
     AND student."status"='ENROLLED'
 ) OR (
   SELECT count(*) FROM jsonb_array_elements(
     snapshot."composedStudentCards"
   ) AS card(value) WHERE card.value->>'studentId'=NEW."studentId"
 )<>1 THEN
   RAISE EXCEPTION 'Exact current enrolled pupil must occur once in report'
     USING ERRCODE='23503';
 END IF;
 NEW."evidenceRevision":=snapshot."evidenceRevision";
 NEW."status":='INTERNAL_OWNER_PREVIEW_NOT_RELEASED';
 NEW."viewedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultPrivateGradePreviewAudit_validate"
 BEFORE INSERT ON "ResultPrivateGradePreviewAudit"
 FOR EACH ROW EXECUTE FUNCTION "validate_private_grade_preview_audit"();
CREATE TRIGGER "ResultPrivateGradePreviewAudit_immutable"
 BEFORE UPDATE OR DELETE ON "ResultPrivateGradePreviewAudit"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultPrivateGradePreviewAudit_no_truncate"
 BEFORE TRUNCATE ON "ResultPrivateGradePreviewAudit"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

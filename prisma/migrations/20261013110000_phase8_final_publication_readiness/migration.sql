-- Phase 8: INTERNAL final-release readiness predicate only.
-- NO publication event, result/status mutation, grade computation, visibility,
-- download, student/guardian API or final School Super Admin publish action.
-- Future final release must re-run this check within its SERIALIZABLE, locked
-- and immutable INSERT transaction. A prior true result cannot authorize release.
CREATE FUNCTION "assert_result_publication_readiness"(
 p_school TEXT, p_evidence TEXT, p_owner_membership TEXT, p_owner_user TEXT
) RETURNS BOOLEAN AS $$
DECLARE
 snapshot RECORD;
 adopted RECORD;
 latest_id TEXT;
 current_manifest JSONB;
BEGIN
 -- Serialize school-scoped final-release checks against the existing
 -- adoption/evidence/review insert guards. This check performs NO publication.
 PERFORM 1 FROM "School" school
 WHERE school."id"=p_school AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Current active school required' USING ERRCODE='23503';
 END IF;

 -- The backend must supply the signed-in user and its own same-school
 -- membership, never browser-selected school-owner IDs.
 IF NOT EXISTS (
  SELECT 1 FROM "Membership" owner
  WHERE owner."schoolId"=p_school AND owner."id"=p_owner_membership
    AND owner."userId"=p_owner_user AND owner."isActive"=true
    AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
  RAISE EXCEPTION 'Current exact school owner required'
   USING ERRCODE='23503';
 END IF;

 SELECT evidence.*, section."id" AS "actualSectionId",
   section."stage" AS "actualStage" INTO snapshot
 FROM "ResultSheetEvidence" evidence
 JOIN "AcademicSession" session ON session."schoolId"=evidence."schoolId"
   AND session."id"=evidence."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=evidence."schoolId"
   AND term."id"=evidence."termId" AND term."sessionId"=session."id"
   AND term."status"='ACTIVE'
 JOIN "SchoolClass" classroom ON classroom."schoolId"=evidence."schoolId"
   AND classroom."id"=evidence."classId" AND classroom."isActive"=true
 JOIN "SchoolSection" section ON section."schoolId"=classroom."schoolId"
   AND section."id"=classroom."sectionId" AND section."isActive"=true
 JOIN "Subject" subject ON subject."schoolId"=evidence."schoolId"
   AND subject."id"=evidence."subjectId" AND subject."isActive"=true
 JOIN "Membership" teacher ON teacher."schoolId"=evidence."schoolId"
   AND teacher."id"=evidence."teacherMembershipId"
   AND teacher."userId"=evidence."teacherUserId"
   AND teacher."role"='TEACHER' AND teacher."isActive"=true
 JOIN "TeacherClassSubjectAssignment" assignment
   ON assignment."schoolId"=evidence."schoolId"
   AND assignment."id"=evidence."assignmentId"
   AND assignment."membershipId"=teacher."id"
   AND assignment."classId"=evidence."classId"
   AND assignment."subjectId"=evidence."subjectId"
   AND assignment."sessionId"=evidence."sessionId"
   AND assignment."status"='ACTIVE'
 WHERE evidence."schoolId"=p_school AND evidence."id"=p_evidence;

 IF snapshot."id" IS NULL THEN
  RAISE EXCEPTION 'Current exact teacher evidence required'
   USING ERRCODE='23503';
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM "ResultSheetReview" review
  JOIN "Membership" reviewer ON reviewer."schoolId"=review."schoolId"
    AND reviewer."id"=review."reviewerMembershipId"
    AND reviewer."userId"=review."reviewerUserId"
    AND reviewer."isActive"=true
    AND reviewer."userId"<>snapshot."teacherUserId"
    AND ((reviewer."role"='HEAD_OF_SECTION' AND snapshot."actualStage"='PRIMARY')
      OR (reviewer."role"='PRINCIPAL' AND snapshot."actualStage"='SECONDARY'))
  JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
    AND scope."type"='SECTION' AND scope."verified"=true
    AND scope."scopeId"=snapshot."actualSectionId"
  WHERE review."schoolId"=p_school AND review."evidenceId"=p_evidence
    AND review."action"='APPROVED'
 ) THEN
  RAISE EXCEPTION 'Current independent section approval required'
   USING ERRCODE='23503';
 END IF;

 SELECT adoption."id", policy."quizWeight", policy."testWeight",
   policy."examWeight" INTO adopted
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" policy
   ON policy."schoolId"=adoption."schoolId"
   AND policy."id"=adoption."policyId"
 WHERE adoption."schoolId"=p_school
   AND adoption."sessionId"=snapshot."sessionId"
   AND adoption."termId"=snapshot."termId"
   AND adoption."classId"=snapshot."classId"
   AND adoption."subjectId"=snapshot."subjectId"
 ORDER BY adoption."ordinal" DESC LIMIT 1;
 IF adopted."id" IS DISTINCT FROM snapshot."adoptionId" THEN
  RAISE EXCEPTION 'Evidence grading adoption is no longer current'
   USING ERRCODE='23505';
 END IF;

 SELECT evidence."id" INTO latest_id FROM "ResultSheetEvidence" evidence
 WHERE evidence."schoolId"=p_school
   AND evidence."sessionId"=snapshot."sessionId"
   AND evidence."termId"=snapshot."termId"
   AND evidence."classId"=snapshot."classId"
   AND evidence."subjectId"=snapshot."subjectId"
 ORDER BY evidence."revision" DESC LIMIT 1;
 IF latest_id IS DISTINCT FROM p_evidence THEN
  RAISE EXCEPTION 'A newer result-sheet revision superseded this evidence'
   USING ERRCODE='23505';
 END IF;

 current_manifest:="build_result_sheet_source_manifest"(
   snapshot."schoolId", snapshot."sessionId", snapshot."termId",
   snapshot."classId", snapshot."subjectId", snapshot."assignmentId");
 PERFORM "assert_result_sheet_manifest_complete"(current_manifest);
 PERFORM "assert_result_sheet_weighted_categories"(
   current_manifest, adopted."quizWeight", adopted."testWeight",
   adopted."examWeight");
 IF current_manifest IS DISTINCT FROM snapshot."sourceManifest" THEN
  RAISE EXCEPTION 'Source marks or enrolled roster changed since approval'
   USING ERRCODE='23505';
 END IF;
 RETURN TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE;

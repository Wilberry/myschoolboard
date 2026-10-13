-- Phase 8: immutable, DB-computed teacher result evidence and distinct academic
-- section review. NO School Super Admin publication or student/parent access.
CREATE TABLE "ResultSheetEvidence" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
 "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "assignmentId" TEXT NOT NULL, "teacherMembershipId" TEXT NOT NULL,
 "teacherUserId" TEXT NOT NULL, "adoptionId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "reason" VARCHAR(500) NOT NULL,
 "sourceManifest" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "studentCount" INTEGER NOT NULL DEFAULT 0,
 "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultSheetEvidence_pkey" PRIMARY KEY("id"),
 CONSTRAINT "ResultSheetEvidence_content_check" CHECK (
  "revision">=1 AND "studentCount" BETWEEN 1 AND 500
  AND jsonb_typeof("sourceManifest")='array'
  AND jsonb_array_length("sourceManifest")="studentCount"
  AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ResultSheetEvidence_schoolId_id_key"
 ON "ResultSheetEvidence"("schoolId","id");
CREATE UNIQUE INDEX "ResultSheetEvidence_context_revision_key"
 ON "ResultSheetEvidence"("schoolId","sessionId","termId","classId","subjectId","revision");
CREATE INDEX "ResultSheetEvidence_schoolId_teacherMembershipId_preparedAt_idx"
 ON "ResultSheetEvidence"("schoolId","teacherMembershipId","preparedAt");
ALTER TABLE "ResultSheetEvidence" ADD CONSTRAINT "ResultSheetEvidence_schoolId_fkey"
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultSheetEvidence" ADD CONSTRAINT "ResultSheetEvidence_teacher_fkey"
 FOREIGN KEY("schoolId","teacherMembershipId")
 REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultSheetEvidence" ADD CONSTRAINT "ResultSheetEvidence_assignment_fkey"
 FOREIGN KEY("schoolId","assignmentId","teacherMembershipId",
  "classId","subjectId","sessionId")
 REFERENCES "TeacherClassSubjectAssignment"("schoolId","id","membershipId",
  "classId","subjectId","sessionId")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultSheetEvidence" ADD CONSTRAINT "ResultSheetEvidence_adoption_fkey"
 FOREIGN KEY("schoolId","adoptionId") REFERENCES "ResultGradingAdoption"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "ResultSheetReview" (
 "id" TEXT NOT NULL,"schoolId" TEXT NOT NULL,
 "evidenceId" TEXT NOT NULL, "reviewerMembershipId" TEXT NOT NULL,
 "reviewerUserId" TEXT NOT NULL, "action" "ManualMarkReviewAction" NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultSheetReview_pkey" PRIMARY KEY("id"),
 CONSTRAINT "ResultSheetReview_reason_check"
 CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ResultSheetReview_schoolId_evidenceId_key"
 ON "ResultSheetReview"("schoolId","evidenceId");
CREATE INDEX "ResultSheetReview_schoolId_reviewedAt_idx"
 ON "ResultSheetReview"("schoolId","reviewedAt");
ALTER TABLE "ResultSheetReview" ADD CONSTRAINT "ResultSheetReview_schoolId_fkey"
 FOREIGN KEY("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultSheetReview" ADD CONSTRAINT "ResultSheetReview_evidence_fkey"
 FOREIGN KEY("schoolId","evidenceId")
 REFERENCES "ResultSheetEvidence"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultSheetReview" ADD CONSTRAINT "ResultSheetReview_reviewer_fkey"
 FOREIGN KEY("schoolId","reviewerMembershipId")
 REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- The manifest is derived only from current source tables. No client-supplied
-- student IDs, answer keys, marks, totals or JSON values are accepted.
CREATE FUNCTION "build_result_sheet_source_manifest"(
 p_school TEXT, p_session TEXT, p_term TEXT, p_class TEXT, p_subject TEXT,
 p_assignment TEXT
) RETURNS JSONB AS $$
DECLARE evidence JSONB;
BEGIN
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'studentId',pupil."id",
    'admissionNumber',pupil."admissionNumber",
    'givenName',pupil."givenName",
    'familyName',pupil."familyName",
    'cbt',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'draftId',draft."id",'kind',draft."kind",
        'attemptId',best."attemptId",
        'earnedPoints',best."earnedPoints",
        'maxPoints',best."maxPoints") ORDER BY draft."id")
      FROM "AssessmentDraft" draft
      JOIN "AssessmentDraftSeal" seal
        ON seal."schoolId"=draft."schoolId" AND seal."draftId"=draft."id"
      JOIN "AssessmentReviewEvent" approval
        ON approval."schoolId"=draft."schoolId" AND approval."draftId"=draft."id"
        AND approval."decision"='APPROVED'
      JOIN "AssessmentPublicationEvent" publication
        ON publication."schoolId"=draft."schoolId"
        AND publication."draftId"=draft."id" AND publication."action"='PUBLISHED'
      LEFT JOIN "AssessmentPublicationEvent" withdrawal
        ON withdrawal."schoolId"=draft."schoolId"
        AND withdrawal."draftId"=draft."id" AND withdrawal."action"='WITHDRAWN'
      LEFT JOIN LATERAL (
        SELECT attempt."id" AS "attemptId",score."earnedPoints",score."maxPoints"
        FROM "AssessmentAttempt" attempt
        JOIN "AssessmentAttemptSubmission" submitted
          ON submitted."schoolId"=attempt."schoolId"
          AND submitted."attemptId"=attempt."id"
        JOIN "AssessmentAttemptScore" score
          ON score."schoolId"=attempt."schoolId"
          AND score."attemptId"=attempt."id"
        WHERE attempt."schoolId"=draft."schoolId"
          AND attempt."draftId"=draft."id"
          AND attempt."studentId"=pupil."id"
          AND attempt."enrollmentId"=enrollment."id"
        ORDER BY score."percentBps" DESC,score."earnedPoints" DESC,
          attempt."attemptNumber" ASC LIMIT 1
      ) best ON true
      WHERE draft."schoolId"=p_school AND draft."sessionId"=p_session
        AND draft."termId"=p_term AND draft."classId"=p_class
        AND draft."subjectId"=p_subject AND draft."assignmentId"=p_assignment
        AND withdrawal."id" IS NULL
    ),'[]'::jsonb),
    'manual',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'componentId',component."id",'kind',component."kind",
        'markId',mark."id",
        'originalPoints',mark."earnedPoints",
        'effectivePoints',CASE
          WHEN corrected."proposedPoints" IS NOT NULL
            THEN corrected."proposedPoints"
          WHEN initial."action"='APPROVED' THEN mark."earnedPoints"
          ELSE NULL END,
        'maxPoints',component."maxPoints",
        'approvedCorrectionRevision',corrected."revision",
        'pendingCorrection',COALESCE(pending."pending",false)
      ) ORDER BY component."id")
      FROM "AssessmentManualComponent" component
      LEFT JOIN "AssessmentManualMarkProposal" mark
        ON mark."schoolId"=component."schoolId"
        AND mark."componentId"=component."id"
        AND mark."studentId"=pupil."id"
        AND mark."enrollmentId"=enrollment."id"
      LEFT JOIN "AssessmentManualMarkDecision" initial
        ON initial."schoolId"=mark."schoolId"
        AND initial."proposalId"=mark."id"
      LEFT JOIN LATERAL (
        SELECT request."proposedPoints",request."revision"
        FROM "AssessmentManualCorrectionRequest" request
        JOIN "AssessmentManualCorrectionDecision" decision
          ON decision."schoolId"=request."schoolId"
          AND decision."requestId"=request."id"
          AND decision."action"='APPROVED'
        WHERE request."schoolId"=mark."schoolId"
          AND request."proposalId"=mark."id"
        ORDER BY request."revision" DESC LIMIT 1
      ) corrected ON true
      LEFT JOIN LATERAL (
        SELECT true AS "pending"
        FROM "AssessmentManualCorrectionRequest" request
        LEFT JOIN "AssessmentManualCorrectionDecision" decision
          ON decision."schoolId"=request."schoolId"
          AND decision."requestId"=request."id"
        WHERE request."schoolId"=mark."schoolId"
          AND request."proposalId"=mark."id"
          AND decision."id" IS NULL
        LIMIT 1
      ) pending ON true
      WHERE component."schoolId"=p_school
        AND component."sessionId"=p_session
        AND component."termId"=p_term AND component."classId"=p_class
        AND component."subjectId"=p_subject
        AND component."assignmentId"=p_assignment
    ),'[]'::jsonb)
  ) ORDER BY pupil."id"),'[]'::jsonb) INTO evidence
 FROM "StudentEnrollment" enrollment
 JOIN "StudentRecord" pupil ON pupil."schoolId"=enrollment."schoolId"
  AND pupil."id"=enrollment."studentId" AND pupil."status"='ENROLLED'
 WHERE enrollment."schoolId"=p_school
  AND enrollment."sessionId"=p_session AND enrollment."classId"=p_class
  AND enrollment."status"='ACTIVE';
 RETURN evidence;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full completeness must be checked at BOTH preparation and review. Pending,
-- absent or returned academic marks and unscored published CBT are blockers.
CREATE FUNCTION "assert_result_sheet_manifest_complete"(p_manifest JSONB)
RETURNS VOID AS $$
DECLARE pupil JSONB;
DECLARE score JSONB;
DECLARE any_source BOOLEAN := false;
DECLARE pupil_has_source BOOLEAN;
BEGIN
 IF jsonb_typeof(p_manifest)<>'array' OR jsonb_array_length(p_manifest)
   NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'Bounded enrolled result roster required' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_manifest) AS elem(value))
   <> (SELECT count(DISTINCT elem.value->>'studentId')
       FROM jsonb_array_elements(p_manifest) AS elem(value))
 THEN RAISE EXCEPTION 'Duplicate active enrollment' USING ERRCODE='23514'; END IF;
 FOR pupil IN SELECT value FROM jsonb_array_elements(p_manifest) LOOP
   pupil_has_source:=false;
   FOR score IN SELECT value FROM jsonb_array_elements(pupil->'cbt') LOOP
     any_source:=true; pupil_has_source:=true;
     IF score->>'attemptId' IS NULL OR score->>'earnedPoints' IS NULL
     THEN RAISE EXCEPTION 'CBT attempt not scored and submitted'
       USING ERRCODE='23514'; END IF;
   END LOOP;
   FOR score IN SELECT value FROM jsonb_array_elements(pupil->'manual') LOOP
     any_source:=true; pupil_has_source:=true;
     IF score->>'markId' IS NULL OR score->>'effectivePoints' IS NULL
       OR score->>'pendingCorrection'='true'
     THEN RAISE EXCEPTION 'Manual mark not independently approved'
       USING ERRCODE='23514'; END IF;
   END LOOP;
   IF NOT pupil_has_source THEN
     RAISE EXCEPTION 'Every pupil requires an assessment source'
       USING ERRCODE='23514';
   END IF;
 END LOOP;
 IF NOT any_source THEN
  RAISE EXCEPTION 'No assessment source available' USING ERRCODE='23514';
 END IF;
END;
$$ LANGUAGE plpgsql;

-- Every ENROLLED pupil must have a source for EACH adopted positive-weight
-- category; class-wide coverage is insufficient (one pupil cannot supply
-- another pupil's missing QUIZ/TEST/EXAM evidence).
CREATE FUNCTION "assert_result_sheet_weighted_categories"(
 p_manifest JSONB, p_quiz_weight INTEGER, p_test_weight INTEGER,
 p_exam_weight INTEGER
) RETURNS BOOLEAN AS $
BEGIN
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_manifest) AS student(value)
   WHERE (p_quiz_weight>0 AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(
       (student.value->'cbt')||(student.value->'manual')) AS item(value)
     WHERE item.value->>'kind'='QUIZ'
   )) OR (p_test_weight>0 AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(
       (student.value->'cbt')||(student.value->'manual')) AS item(value)
     WHERE item.value->>'kind'='TEST'
   )) OR (p_exam_weight>0 AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(
       (student.value->'cbt')||(student.value->'manual')) AS item(value)
     WHERE item.value->>'kind'='EXAM'
   ))
 ) THEN
   RAISE EXCEPTION 'Missing category required by adopted policy for an enrolled pupil'
     USING ERRCODE='23514';
 END IF;
 RETURN true;
END;
$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_result_sheet_evidence"() RETURNS trigger AS $
DECLARE current_adoption RECORD;
DECLARE previous RECORD;
DECLARE next_revision INT;
DECLARE frozen JSONB;
BEGIN
 PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
  AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active school required' USING ERRCODE='23503'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "Membership" teacher
  JOIN "TeacherClassSubjectAssignment" assignment
    ON assignment."schoolId"=teacher."schoolId"
    AND assignment."membershipId"=teacher."id"
    AND assignment."id"=NEW."assignmentId"
    AND assignment."sessionId"=NEW."sessionId"
    AND assignment."classId"=NEW."classId"
    AND assignment."subjectId"=NEW."subjectId"
    AND assignment."status"='ACTIVE'
  JOIN "AcademicSession" session ON session."schoolId"=teacher."schoolId"
    AND session."id"=NEW."sessionId" AND session."status"='ACTIVE'
  JOIN "AcademicTerm" term ON term."schoolId"=teacher."schoolId"
    AND term."sessionId"=session."id"
    AND term."id"=NEW."termId" AND term."status"='ACTIVE'
  JOIN "SchoolClass" room ON room."schoolId"=teacher."schoolId"
    AND room."id"=NEW."classId" AND room."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
    AND section."id"=room."sectionId" AND section."isActive"=true
  JOIN "Subject" subject ON subject."schoolId"=teacher."schoolId"
    AND subject."id"=NEW."subjectId" AND subject."isActive"=true
  WHERE teacher."schoolId"=NEW."schoolId"
    AND teacher."id"=NEW."teacherMembershipId"
    AND teacher."userId"=NEW."teacherUserId"
    AND teacher."role"='TEACHER' AND teacher."isActive"=true
 ) THEN RAISE EXCEPTION 'Only exact active academic teacher may prepare result evidence'
  USING ERRCODE='23503'; END IF;
 SELECT adoption."id",adoption."ordinal",policy."quizWeight",
  policy."testWeight",policy."examWeight" INTO current_adoption
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" policy
  ON policy."schoolId"=adoption."schoolId" AND policy."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
  AND adoption."sessionId"=NEW."sessionId"
  AND adoption."termId"=NEW."termId"
  AND adoption."classId"=NEW."classId"
  AND adoption."subjectId"=NEW."subjectId"
 ORDER BY adoption."ordinal" DESC LIMIT 1;
 IF current_adoption."id" IS NULL OR current_adoption."id"<>NEW."adoptionId"
 THEN RAISE EXCEPTION 'Latest adopted exact academic grading policy required'
  USING ERRCODE='23503'; END IF;
 SELECT prior."id",prior."sourceManifest",prior."adoptionId",review."action" INTO previous
 FROM "ResultSheetEvidence" prior
 LEFT JOIN "ResultSheetReview" review
  ON review."schoolId"=prior."schoolId" AND review."evidenceId"=prior."id"
 WHERE prior."schoolId"=NEW."schoolId"
  AND prior."sessionId"=NEW."sessionId"
  AND prior."termId"=NEW."termId"
  AND prior."classId"=NEW."classId"
  AND prior."subjectId"=NEW."subjectId"
 ORDER BY prior."revision" DESC LIMIT 1;
 IF previous."id" IS NOT NULL AND previous."action" IS NULL
 THEN RAISE EXCEPTION 'Existing result evidence is awaiting independent review'
  USING ERRCODE='23505'; END IF;
 SELECT COALESCE(MAX(e."revision"),0)::int+1 INTO next_revision
 FROM "ResultSheetEvidence" e WHERE e."schoolId"=NEW."schoolId"
  AND e."sessionId"=NEW."sessionId" AND e."termId"=NEW."termId"
  AND e."classId"=NEW."classId" AND e."subjectId"=NEW."subjectId";
 frozen:="build_result_sheet_source_manifest"(
  NEW."schoolId",NEW."sessionId",NEW."termId",
  NEW."classId",NEW."subjectId",NEW."assignmentId");
 PERFORM "assert_result_sheet_manifest_complete"(frozen);
 IF previous."id" IS NOT NULL AND
   previous."sourceManifest"=frozen AND
   previous."adoptionId"=NEW."adoptionId"
 THEN RAISE EXCEPTION 'Identical source and adoption cannot create a new revision'
  USING ERRCODE='23505'; END IF;
 -- Enforce mandatory adopted categories for EACH pupil, not merely the class.
 PERFORM "assert_result_sheet_weighted_categories"(
  frozen,current_adoption."quizWeight",current_adoption."testWeight",
  current_adoption."examWeight");
 NEW."sourceManifest":=frozen;
 NEW."studentCount":=jsonb_array_length(frozen);
 NEW."revision":=next_revision;
 NEW."preparedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultSheetEvidence_validate"
 BEFORE INSERT ON "ResultSheetEvidence"
 FOR EACH ROW EXECUTE FUNCTION "validate_result_sheet_evidence"();

CREATE FUNCTION "validate_result_sheet_review"() RETURNS trigger AS $$
DECLARE snapshot RECORD;
DECLARE current_adoption RECORD;
DECLARE current_evidence TEXT;
DECLARE now_manifest JSONB;
BEGIN
 PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
  AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active school required' USING ERRCODE='23503'; END IF;
 SELECT evidence.* ,room."sectionId",section."stage" INTO snapshot
 FROM "ResultSheetEvidence" evidence
 JOIN "SchoolClass" room ON room."schoolId"=evidence."schoolId"
  AND room."id"=evidence."classId" AND room."isActive"=true
 JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
  AND section."id"=room."sectionId" AND section."isActive"=true
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
 JOIN "AcademicSession" session ON session."schoolId"=evidence."schoolId"
  AND session."id"=evidence."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=evidence."schoolId"
  AND term."sessionId"=session."id"
  AND term."id"=evidence."termId" AND term."status"='ACTIVE'
 JOIN "Subject" subject ON subject."schoolId"=evidence."schoolId"
  AND subject."id"=evidence."subjectId" AND subject."isActive"=true
 WHERE evidence."schoolId"=NEW."schoolId" AND evidence."id"=NEW."evidenceId";
 IF snapshot."id" IS NULL THEN
  RAISE EXCEPTION 'Current exact teacher result evidence required' USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "Membership" reviewer
  JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
    AND scope."type"='SECTION' AND scope."verified"=true
    AND scope."scopeId"=snapshot."sectionId"
  WHERE reviewer."schoolId"=NEW."schoolId"
    AND reviewer."id"=NEW."reviewerMembershipId"
    AND reviewer."userId"=NEW."reviewerUserId"
    AND reviewer."isActive"=true
    AND NEW."reviewerUserId"<>snapshot."teacherUserId"
    AND ((reviewer."role"='HEAD_OF_SECTION' AND snapshot."stage"='PRIMARY')
      OR (reviewer."role"='PRINCIPAL' AND snapshot."stage"='SECONDARY'))
 ) THEN RAISE EXCEPTION 'Independent verified exact-section result reviewer required'
  USING ERRCODE='23503'; END IF;
 SELECT adoption."id",policy."quizWeight",policy."testWeight",
  policy."examWeight" INTO current_adoption
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" policy
   ON policy."schoolId"=adoption."schoolId" AND policy."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
  AND adoption."sessionId"=snapshot."sessionId"
  AND adoption."termId"=snapshot."termId"
  AND adoption."classId"=snapshot."classId"
  AND adoption."subjectId"=snapshot."subjectId"
 ORDER BY adoption."ordinal" DESC LIMIT 1;
 SELECT evidence."id" INTO current_evidence
 FROM "ResultSheetEvidence" evidence
 WHERE evidence."schoolId"=NEW."schoolId"
  AND evidence."sessionId"=snapshot."sessionId"
  AND evidence."termId"=snapshot."termId"
  AND evidence."classId"=snapshot."classId"
  AND evidence."subjectId"=snapshot."subjectId"
 ORDER BY evidence."revision" DESC LIMIT 1;
 IF current_evidence IS DISTINCT FROM snapshot."id" THEN
  RAISE EXCEPTION 'Only the latest result evidence revision may be decided'
    USING ERRCODE='23505'; END IF;
 -- Stale source or policy must never be APPROVED. An authorized reviewer can
 -- still RETURN stale evidence so the teacher may submit a corrected revision.
 IF NEW."action"='APPROVED' THEN
   IF current_adoption."id" IS DISTINCT FROM snapshot."adoptionId" THEN
     RAISE EXCEPTION 'Adopted grading policy changed since preparation'
       USING ERRCODE='23505';
   END IF;
   now_manifest:="build_result_sheet_source_manifest"(
    snapshot."schoolId",snapshot."sessionId",snapshot."termId",
    snapshot."classId",snapshot."subjectId",snapshot."assignmentId");
   PERFORM "assert_result_sheet_manifest_complete"(now_manifest);
   PERFORM "assert_result_sheet_weighted_categories"(
     now_manifest,current_adoption."quizWeight",current_adoption."testWeight",
     current_adoption."examWeight");
   IF now_manifest IS DISTINCT FROM snapshot."sourceManifest" THEN
     RAISE EXCEPTION 'Source marks or student roster changed since preparation'
       USING ERRCODE='23505';
   END IF;
 END IF;
 NEW."reviewedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultSheetReview_validate"
 BEFORE INSERT ON "ResultSheetReview"
 FOR EACH ROW EXECUTE FUNCTION "validate_result_sheet_review"();
CREATE TRIGGER "ResultSheetEvidence_immutable"
 BEFORE UPDATE OR DELETE ON "ResultSheetEvidence"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultSheetReview_immutable"
 BEFORE UPDATE OR DELETE ON "ResultSheetReview"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultSheetEvidence_no_truncate"
 BEFORE TRUNCATE ON "ResultSheetEvidence"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "ResultSheetReview_no_truncate"
 BEFORE TRUNCATE ON "ResultSheetReview"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

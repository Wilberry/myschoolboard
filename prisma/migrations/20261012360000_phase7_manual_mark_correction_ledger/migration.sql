-- Phase 7: append-only manual mark corrections with independent
-- verified exact-section decisions. Original mark and approvals preserved.
CREATE TABLE "AssessmentManualCorrectionRequest" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "proposalId" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
 "proposedPoints" INTEGER NOT NULL, "reason" VARCHAR(500) NOT NULL,
 "requesterMembershipId" TEXT NOT NULL, "requesterUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AssessmentManualCorrectionRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AssessmentManualCorrectionRequest_values_check"
  CHECK ("revision" >= 1 AND "proposedPoints" BETWEEN 0 AND 100),
 CONSTRAINT "AssessmentManualCorrectionRequest_reason_check"
  CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentManualCorrectionRequest_schoolId_id_key"
 ON "AssessmentManualCorrectionRequest"("schoolId","id");
CREATE UNIQUE INDEX "AssessmentManualCorrectionRequest_schoolId_proposalId_revision_key"
 ON "AssessmentManualCorrectionRequest"("schoolId","proposalId","revision");
CREATE INDEX "AssessmentManualCorrectionRequest_schoolId_proposalId_createdAt_idx"
 ON "AssessmentManualCorrectionRequest"("schoolId","proposalId","createdAt");
ALTER TABLE "AssessmentManualCorrectionRequest" ADD CONSTRAINT
 "AssessmentManualCorrectionRequest_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualCorrectionRequest" ADD CONSTRAINT
 "AssessmentManualCorrectionRequest_proposal_fkey"
 FOREIGN KEY ("schoolId","proposalId")
 REFERENCES "AssessmentManualMarkProposal"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualCorrectionRequest" ADD CONSTRAINT
 "AssessmentManualCorrectionRequest_requester_fkey"
 FOREIGN KEY ("schoolId","requesterMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentManualCorrectionDecision" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "requestId" TEXT NOT NULL, "reviewerMembershipId" TEXT NOT NULL,
 "reviewerUserId" TEXT NOT NULL, "action" "ManualMarkReviewAction" NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AssessmentManualCorrectionDecision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AssessmentManualCorrectionDecision_reason_check"
  CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentManualCorrectionDecision_schoolId_requestId_key"
 ON "AssessmentManualCorrectionDecision"("schoolId","requestId");
CREATE INDEX "AssessmentManualCorrectionDecision_schoolId_decidedAt_idx"
 ON "AssessmentManualCorrectionDecision"("schoolId","decidedAt");
ALTER TABLE "AssessmentManualCorrectionDecision" ADD CONSTRAINT
 "AssessmentManualCorrectionDecision_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualCorrectionDecision" ADD CONSTRAINT
 "AssessmentManualCorrectionDecision_request_fkey"
 FOREIGN KEY ("schoolId","requestId")
 REFERENCES "AssessmentManualCorrectionRequest"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualCorrectionDecision" ADD CONSTRAINT
 "AssessmentManualCorrectionDecision_reviewer_fkey"
 FOREIGN KEY ("schoolId","reviewerMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_manual_correction_request"()
RETURNS trigger AS $$
DECLARE
 max_points INTEGER;
 current_points INTEGER;
 next_revision INTEGER;
BEGIN
 PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
  AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current school required' USING ERRCODE='23503'; END IF;
 SELECT component."maxPoints" INTO max_points
 FROM "AssessmentManualMarkProposal" proposal
 JOIN "AssessmentManualMarkDecision" original
  ON original."schoolId"=proposal."schoolId"
  AND original."proposalId"=proposal."id"
  AND original."action"='APPROVED'
 JOIN "AssessmentManualComponent" component
  ON component."schoolId"=proposal."schoolId"
  AND component."id"=proposal."componentId"
  AND component."classId"=proposal."classId"
  AND component."sessionId"=proposal."sessionId"
 JOIN "Membership" requester
  ON requester."schoolId"=component."schoolId"
  AND requester."id"=component."teacherMembershipId"
  AND requester."id"=NEW."requesterMembershipId"
  AND requester."userId"=component."teacherUserId"
  AND requester."userId"=NEW."requesterUserId"
  AND requester."role"='TEACHER' AND requester."isActive"=true
 JOIN "TeacherClassSubjectAssignment" assignment
  ON assignment."schoolId"=component."schoolId"
  AND assignment."id"=component."assignmentId"
  AND assignment."membershipId"=requester."id"
  AND assignment."classId"=component."classId"
  AND assignment."subjectId"=component."subjectId"
  AND assignment."sessionId"=component."sessionId"
  AND assignment."status"='ACTIVE'
 JOIN "AcademicSession" session
  ON session."schoolId"=component."schoolId"
  AND session."id"=component."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=component."schoolId"
  AND term."sessionId"=session."id" AND term."id"=component."termId"
  AND term."status"='ACTIVE'
 JOIN "SchoolClass" room ON room."schoolId"=component."schoolId"
  AND room."id"=component."classId" AND room."isActive"=true
 JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
  AND section."id"=room."sectionId" AND section."isActive"=true
 JOIN "Subject" subject ON subject."schoolId"=component."schoolId"
  AND subject."id"=component."subjectId" AND subject."isActive"=true
 JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=proposal."schoolId"
  AND enrollment."id"=proposal."enrollmentId"
  AND enrollment."studentId"=proposal."studentId"
  AND enrollment."classId"=component."classId"
  AND enrollment."sessionId"=component."sessionId"
  AND enrollment."status"='ACTIVE'
 JOIN "StudentRecord" pupil ON pupil."schoolId"=proposal."schoolId"
  AND pupil."id"=proposal."studentId" AND pupil."status"='ENROLLED'
 WHERE proposal."schoolId"=NEW."schoolId" AND proposal."id"=NEW."proposalId";
 IF max_points IS NULL OR NEW."proposedPoints" > max_points THEN
  RAISE EXCEPTION 'Approved exact teacher, enrolled child and valid correction needed'
   USING ERRCODE='23503';
 END IF;
 IF EXISTS (
  SELECT 1 FROM "AssessmentManualCorrectionRequest" earlier
  LEFT JOIN "AssessmentManualCorrectionDecision" decision
   ON decision."schoolId"=earlier."schoolId"
   AND decision."requestId"=earlier."id"
  WHERE earlier."schoolId"=NEW."schoolId"
   AND earlier."proposalId"=NEW."proposalId"
   AND decision."id" IS NULL
 ) THEN RAISE EXCEPTION 'Existing correction is awaiting review'
   USING ERRCODE='23505'; END IF;
 SELECT COALESCE((
  SELECT earlier."proposedPoints"
   FROM "AssessmentManualCorrectionRequest" earlier
   JOIN "AssessmentManualCorrectionDecision" decision
    ON decision."schoolId"=earlier."schoolId"
    AND decision."requestId"=earlier."id"
    AND decision."action"='APPROVED'
   WHERE earlier."schoolId"=proposal."schoolId"
    AND earlier."proposalId"=proposal."id"
   ORDER BY earlier."revision" DESC LIMIT 1
 ), proposal."earnedPoints") INTO current_points
 FROM "AssessmentManualMarkProposal" proposal
 WHERE proposal."schoolId"=NEW."schoolId" AND proposal."id"=NEW."proposalId";
 IF NEW."proposedPoints"=current_points THEN
  RAISE EXCEPTION 'Correction must change effective approved mark'
   USING ERRCODE='23514';
 END IF;
 SELECT COALESCE(MAX(earlier."revision"),0)::int + 1 INTO next_revision
 FROM "AssessmentManualCorrectionRequest" earlier
 WHERE earlier."schoolId"=NEW."schoolId"
  AND earlier."proposalId"=NEW."proposalId";
 NEW."revision":=next_revision;
 NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentManualCorrectionRequest_validate"
 BEFORE INSERT ON "AssessmentManualCorrectionRequest"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_manual_correction_request"();

CREATE FUNCTION "validate_assessment_manual_correction_decision"()
RETURNS trigger AS $$
DECLARE target_proposal TEXT;
BEGIN
 PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
  AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active school required' USING ERRCODE='23503'; END IF;
 SELECT request."proposalId" INTO target_proposal
 FROM "AssessmentManualCorrectionRequest" request
 WHERE request."schoolId"=NEW."schoolId" AND request."id"=NEW."requestId";
 IF target_proposal IS NULL THEN
  RAISE EXCEPTION 'Unknown correction request' USING ERRCODE='23503';
 END IF;
 PERFORM "assert_manual_mark_section_reviewer"(
  NEW."schoolId",target_proposal,
  NEW."reviewerMembershipId",NEW."reviewerUserId"
 );
 IF EXISTS (
  SELECT 1 FROM "AssessmentManualCorrectionDecision" earlier
  WHERE earlier."schoolId"=NEW."schoolId"
   AND earlier."requestId"=NEW."requestId"
 ) THEN RAISE EXCEPTION 'Correction already terminally decided'
   USING ERRCODE='23505'; END IF;
 IF EXISTS (
  SELECT 1 FROM "AssessmentManualCorrectionRequest" newer
  WHERE newer."schoolId"=NEW."schoolId"
   AND newer."proposalId"=target_proposal
   AND newer."revision">(
    SELECT original."revision" FROM "AssessmentManualCorrectionRequest" original
    WHERE original."schoolId"=NEW."schoolId" AND original."id"=NEW."requestId"
   )
 ) THEN RAISE EXCEPTION 'Cannot decide stale correction revision'
   USING ERRCODE='23505'; END IF;
 NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentManualCorrectionDecision_validate"
 BEFORE INSERT ON "AssessmentManualCorrectionDecision"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_manual_correction_decision"();

CREATE TRIGGER "AssessmentManualCorrectionRequest_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentManualCorrectionRequest"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentManualCorrectionDecision_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentManualCorrectionDecision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentManualCorrectionRequest_no_truncate"
 BEFORE TRUNCATE ON "AssessmentManualCorrectionRequest"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentManualCorrectionDecision_no_truncate"
 BEFORE TRUNCATE ON "AssessmentManualCorrectionDecision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

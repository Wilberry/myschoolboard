-- Phase 7: exactly one initial section-review decision per manual mark.
-- HM only for PRIMARY and Principal only for SECONDARY, verified exact SECTION.
CREATE TYPE "ManualMarkReviewAction" AS ENUM ('APPROVED','RETURNED');
CREATE UNIQUE INDEX "AssessmentManualMarkProposal_schoolId_id_key"
 ON "AssessmentManualMarkProposal"("schoolId","id");
CREATE TABLE "AssessmentManualMarkDecision" (
 "id" TEXT NOT NULL,
 "schoolId" TEXT NOT NULL,
 "proposalId" TEXT NOT NULL,
 "reviewerMembershipId" TEXT NOT NULL,
 "reviewerUserId" TEXT NOT NULL,
 "action" "ManualMarkReviewAction" NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AssessmentManualMarkDecision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AssessmentManualMarkDecision_reason_check"
  CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentManualMarkDecision_schoolId_proposalId_key"
 ON "AssessmentManualMarkDecision"("schoolId","proposalId");
CREATE INDEX "AssessmentManualMarkDecision_schoolId_decidedAt_idx"
 ON "AssessmentManualMarkDecision"("schoolId","decidedAt");
ALTER TABLE "AssessmentManualMarkDecision"
 ADD CONSTRAINT "AssessmentManualMarkDecision_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkDecision"
 ADD CONSTRAINT "AssessmentManualMarkDecision_proposal_fkey"
 FOREIGN KEY ("schoolId","proposalId")
 REFERENCES "AssessmentManualMarkProposal"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkDecision"
 ADD CONSTRAINT "AssessmentManualMarkDecision_reviewer_fkey"
 FOREIGN KEY ("schoolId","reviewerMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

-- Reusable independent SQL authorization for original decisions and later
-- correction decisions. Always called after School row lock.
CREATE FUNCTION "assert_manual_mark_section_reviewer"(
 p_school TEXT, p_proposal TEXT, p_reviewer_member TEXT, p_reviewer_user TEXT
) RETURNS VOID AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM "AssessmentManualMarkProposal" proposal
  JOIN "AssessmentManualComponent" component
   ON component."schoolId"=proposal."schoolId"
   AND component."id"=proposal."componentId"
   AND component."classId"=proposal."classId"
   AND component."sessionId"=proposal."sessionId"
  JOIN "SchoolClass" room ON room."schoolId"=component."schoolId"
   AND room."id"=component."classId" AND room."isActive"=true
  JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
   AND section."id"=room."sectionId" AND section."isActive"=true
  JOIN "Membership" reviewer ON reviewer."schoolId"=proposal."schoolId"
   AND reviewer."id"=p_reviewer_member
   AND reviewer."userId"=p_reviewer_user
   AND reviewer."isActive"=true
  JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
   AND scope."type"='SECTION' AND scope."verified"=true
   AND scope."scopeId"=section."id"
  JOIN "Membership" author ON author."schoolId"=component."schoolId"
   AND author."id"=component."teacherMembershipId"
   AND author."userId"=component."teacherUserId"
   AND author."role"='TEACHER' AND author."isActive"=true
  JOIN "TeacherClassSubjectAssignment" assignment
   ON assignment."schoolId"=component."schoolId"
   AND assignment."id"=component."assignmentId"
   AND assignment."membershipId"=author."id"
   AND assignment."classId"=component."classId"
   AND assignment."subjectId"=component."subjectId"
   AND assignment."sessionId"=component."sessionId"
   AND assignment."status"='ACTIVE'
  JOIN "Subject" subject ON subject."schoolId"=component."schoolId"
   AND subject."id"=component."subjectId" AND subject."isActive"=true
  JOIN "AcademicSession" session ON session."schoolId"=component."schoolId"
   AND session."id"=component."sessionId" AND session."status"='ACTIVE'
  JOIN "AcademicTerm" term ON term."schoolId"=component."schoolId"
   AND term."sessionId"=session."id" AND term."id"=component."termId"
   AND term."status"='ACTIVE'
  JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=proposal."schoolId"
   AND enrollment."id"=proposal."enrollmentId"
   AND enrollment."studentId"=proposal."studentId"
   AND enrollment."classId"=component."classId"
   AND enrollment."sessionId"=component."sessionId"
   AND enrollment."status"='ACTIVE'
  JOIN "StudentRecord" pupil ON pupil."schoolId"=proposal."schoolId"
   AND pupil."id"=proposal."studentId" AND pupil."status"='ENROLLED'
  WHERE proposal."schoolId"=p_school AND proposal."id"=p_proposal
   AND p_reviewer_user <> proposal."actorUserId"
   AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
     OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
 ) THEN
  RAISE EXCEPTION 'Verified exact-section academic reviewer required'
   USING ERRCODE='23503';
 END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_assessment_manual_mark_decision"()
RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
  AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active school required'
  USING ERRCODE='23503'; END IF;
 PERFORM "assert_manual_mark_section_reviewer"(
  NEW."schoolId",NEW."proposalId",
  NEW."reviewerMembershipId",NEW."reviewerUserId");
 IF EXISTS (
  SELECT 1 FROM "AssessmentManualMarkDecision" previous
  WHERE previous."schoolId"=NEW."schoolId"
   AND previous."proposalId"=NEW."proposalId"
 ) THEN RAISE EXCEPTION 'Manual proposal already terminally reviewed'
  USING ERRCODE='23505'; END IF;
 NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentManualMarkDecision_validate"
 BEFORE INSERT ON "AssessmentManualMarkDecision"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_manual_mark_decision"();
CREATE TRIGGER "AssessmentManualMarkDecision_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentManualMarkDecision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentManualMarkDecision_no_truncate"
 BEFORE TRUNCATE ON "AssessmentManualMarkDecision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

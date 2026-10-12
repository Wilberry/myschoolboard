-- Phase 7: teacher-written/offline manual marks as unapproved audit proposals.
-- No changes to existing objective scores, provisional totals or official results.
CREATE TABLE "AssessmentManualComponent" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL, "teacherMembershipId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL, "kind" "AssessmentDraftKind" NOT NULL,
  "title" VARCHAR(180) NOT NULL, "maxPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentManualComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentManualComponent_content_check"
    CHECK ("maxPoints" BETWEEN 1 AND 100 AND
      char_length(btrim("title")) BETWEEN 5 AND 180)
);
CREATE UNIQUE INDEX "AssessmentManualComponent_schoolId_id_key"
  ON "AssessmentManualComponent"("schoolId","id");
CREATE UNIQUE INDEX "AssessmentManualComponent_schoolId_id_classId_sessionId_key"
  ON "AssessmentManualComponent"("schoolId","id","classId","sessionId");
CREATE INDEX "AssessmentManualComponent_schoolId_classId_subjectId_termId_idx"
  ON "AssessmentManualComponent"("schoolId","classId","subjectId","termId");
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_session_fkey"
  FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_term_fkey"
  FOREIGN KEY ("schoolId","sessionId","termId")
  REFERENCES "AcademicTerm"("schoolId","sessionId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_class_fkey"
  FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_subject_fkey"
  FOREIGN KEY ("schoolId","subjectId") REFERENCES "Subject"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_teacher_fkey"
  FOREIGN KEY ("schoolId","teacherMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualComponent" ADD CONSTRAINT "AssessmentManualComponent_assignment_fkey"
  FOREIGN KEY ("schoolId","assignmentId","teacherMembershipId",
    "classId","subjectId","sessionId")
  REFERENCES "TeacherClassSubjectAssignment"("schoolId","id","membershipId",
    "classId","subjectId","sessionId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentManualMarkProposal" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL, "classId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL, "earnedPoints" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentManualMarkProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentManualMarkProposal_points_check"
    CHECK ("earnedPoints" BETWEEN 0 AND 100),
  CONSTRAINT "AssessmentManualMarkProposal_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentManualMarkProposal_schoolId_componentId_studentId_key"
  ON "AssessmentManualMarkProposal"("schoolId","componentId","studentId");
CREATE INDEX "AssessmentManualMarkProposal_schoolId_studentId_createdAt_idx"
  ON "AssessmentManualMarkProposal"("schoolId","studentId","createdAt");
ALTER TABLE "AssessmentManualMarkProposal" ADD CONSTRAINT "AssessmentManualMarkProposal_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkProposal" ADD CONSTRAINT "AssessmentManualMarkProposal_component_fkey"
  FOREIGN KEY ("schoolId","componentId","classId","sessionId")
  REFERENCES "AssessmentManualComponent"("schoolId","id","classId","sessionId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkProposal" ADD CONSTRAINT "AssessmentManualMarkProposal_student_fkey"
  FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkProposal" ADD CONSTRAINT "AssessmentManualMarkProposal_enrollment_fkey"
  FOREIGN KEY ("schoolId","enrollmentId","studentId","classId","sessionId")
  REFERENCES "StudentEnrollment"("schoolId","id","studentId","classId","sessionId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentManualMarkProposal" ADD CONSTRAINT "AssessmentManualMarkProposal_actor_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_manual_component"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school needed for written component'
      USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" teacher
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=teacher."schoolId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."id"=NEW."assignmentId"
      AND assignment."classId"=NEW."classId"
      AND assignment."subjectId"=NEW."subjectId"
      AND assignment."sessionId"=NEW."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=assignment."schoolId"
      AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=period."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=NEW."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=assignment."schoolId"
      AND room."id"=assignment."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=assignment."schoolId"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE teacher."schoolId"=NEW."schoolId"
      AND teacher."id"=NEW."teacherMembershipId"
      AND teacher."userId"=NEW."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
  ) THEN
    RAISE EXCEPTION 'Only current exact class/subject teacher may author component'
      USING ERRCODE='23503';
  END IF;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_assessment_manual_mark_proposal"() RETURNS trigger AS $$
DECLARE max_points INTEGER;
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school needed for written mark'
      USING ERRCODE='23503';
  END IF;
  SELECT component."maxPoints" INTO max_points
    FROM "AssessmentManualComponent" component
    JOIN "Membership" teacher ON teacher."schoolId"=component."schoolId"
      AND teacher."id"=component."teacherMembershipId"
      AND teacher."id"=NEW."actorMembershipId"
      AND teacher."userId"=component."teacherUserId"
      AND teacher."userId"=NEW."actorUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=component."schoolId"
      AND assignment."id"=component."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=component."classId"
      AND assignment."subjectId"=component."subjectId"
      AND assignment."sessionId"=component."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=component."schoolId"
      AND period."id"=component."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=component."schoolId"
      AND term."sessionId"=component."sessionId"
      AND term."id"=component."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=component."schoolId"
      AND room."id"=component."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=component."schoolId"
      AND subject."id"=component."subjectId" AND subject."isActive"=true
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId"=component."schoolId"
      AND enrollment."id"=NEW."enrollmentId"
      AND enrollment."studentId"=NEW."studentId"
      AND enrollment."classId"=component."classId"
      AND enrollment."sessionId"=component."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=component."schoolId"
      AND pupil."id"=enrollment."studentId" AND pupil."status"='ENROLLED'
    WHERE component."schoolId"=NEW."schoolId"
      AND component."id"=NEW."componentId"
      AND component."classId"=NEW."classId"
      AND component."sessionId"=NEW."sessionId";
  IF max_points IS NULL OR NEW."earnedPoints" > max_points THEN
    RAISE EXCEPTION 'Written marks need exact student, assignment and bounded points'
      USING ERRCODE='23514';
  END IF;
  NEW."createdAt" := (clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentManualComponent_validate"
 BEFORE INSERT ON "AssessmentManualComponent"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_manual_component"();
CREATE TRIGGER "AssessmentManualMarkProposal_validate"
 BEFORE INSERT ON "AssessmentManualMarkProposal"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_manual_mark_proposal"();
CREATE TRIGGER "AssessmentManualComponent_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentManualComponent"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentManualMarkProposal_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentManualMarkProposal"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentManualComponent_no_truncate"
 BEFORE TRUNCATE ON "AssessmentManualComponent"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentManualMarkProposal_no_truncate"
 BEFORE TRUNCATE ON "AssessmentManualMarkProposal"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

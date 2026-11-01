-- ASM-REQ-001: a distinct, immutable school super admin authorization
-- to publish/withdraw a previously approved sealed assessment draft.
-- This migration DOES NOT create a student examination read, attempt, key
-- disclosure, score, or grade-sheet interface.
CREATE TYPE "AssessmentPublicationAction" AS ENUM ('PUBLISHED','WITHDRAWN');
CREATE TABLE "AssessmentPublicationEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "action" "AssessmentPublicationAction" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentPublicationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentPublicationEvent_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentPublicationEvent_schoolId_draftId_action_key"
 ON "AssessmentPublicationEvent"("schoolId","draftId","action");
CREATE INDEX "AssessmentPublicationEvent_schoolId_createdAt_idx"
 ON "AssessmentPublicationEvent"("schoolId","createdAt");
ALTER TABLE "AssessmentPublicationEvent"
 ADD CONSTRAINT "AssessmentPublicationEvent_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentPublicationEvent"
 ADD CONSTRAINT "AssessmentPublicationEvent_draft_fkey"
 FOREIGN KEY ("schoolId","draftId") REFERENCES "AssessmentDraft"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentPublicationEvent"
 ADD CONSTRAINT "AssessmentPublicationEvent_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_publication_event"()
RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for assessment publication'
      USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM "AssessmentDraft" draft
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment draft not found in current school'
      USING ERRCODE='23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership" actor
    WHERE actor."schoolId"=NEW."schoolId"
      AND actor."id"=NEW."actorMembershipId"
      AND actor."userId"=NEW."actorUserId"
      AND actor."role"='SCHOOL_SUPER_ADMIN' AND actor."isActive"=true
  ) THEN
    RAISE EXCEPTION 'Only active school super admin may publish assessment'
      USING ERRCODE='23503';
  END IF;

  IF NEW."action"='PUBLISHED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AssessmentDraft" draft
      JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
        AND seal."draftId"=draft."id"
      JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
        AND review."draftId"=draft."id" AND review."decision"='APPROVED'
      JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
        AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
      JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
        AND term."sessionId"=period."id"
        AND term."id"=draft."termId" AND term."status"='ACTIVE'
      JOIN "SchoolClass" room ON room."schoolId"=draft."schoolId"
        AND room."id"=draft."classId" AND room."isActive"=true
      JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
        AND section."id"=room."sectionId" AND section."isActive"=true
      JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
        AND subject."id"=draft."subjectId" AND subject."isActive"=true
      JOIN "Membership" teacher ON teacher."schoolId"=draft."schoolId"
        AND teacher."id"=draft."teacherMembershipId"
        AND teacher."userId"=draft."teacherUserId"
        AND teacher."isActive"=true AND teacher."role"='TEACHER'
      JOIN "TeacherClassSubjectAssignment" assignment
        ON assignment."schoolId"=draft."schoolId"
        AND assignment."id"=draft."assignmentId"
        AND assignment."membershipId"=teacher."id"
        AND assignment."classId"=draft."classId"
        AND assignment."subjectId"=draft."subjectId"
        AND assignment."sessionId"=draft."sessionId"
        AND assignment."status"='ACTIVE'
      WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
        AND (SELECT COUNT(*) FROM "AssessmentDraftQuestion" item
          WHERE item."schoolId"=draft."schoolId"
            AND item."draftId"=draft."id") BETWEEN 1 AND 50
    ) THEN
      RAISE EXCEPTION 'Publication requires separate approved sealed active draft'
        USING ERRCODE='23503';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "AssessmentPublicationEvent" previous
      WHERE previous."schoolId"=NEW."schoolId"
        AND previous."draftId"=NEW."draftId"
    ) THEN
      RAISE EXCEPTION 'Already published or withdrawn; never re-publish'
        USING ERRCODE='23505';
    END IF;
  ELSIF NEW."action"='WITHDRAWN' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AssessmentPublicationEvent" prior
      WHERE prior."schoolId"=NEW."schoolId"
        AND prior."draftId"=NEW."draftId"
        AND prior."action"='PUBLISHED'
    ) OR EXISTS (
      SELECT 1 FROM "AssessmentPublicationEvent" previous
      WHERE previous."schoolId"=NEW."schoolId"
        AND previous."draftId"=NEW."draftId"
        AND previous."action"='WITHDRAWN'
    ) THEN
      RAISE EXCEPTION 'Only currently published assessment may be withdrawn'
        USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentPublicationEvent_validate"
 BEFORE INSERT ON "AssessmentPublicationEvent"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_publication_event"();
CREATE TRIGGER "AssessmentPublicationEvent_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentPublicationEvent"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentPublicationEvent_no_truncate"
 BEFORE TRUNCATE ON "AssessmentPublicationEvent"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

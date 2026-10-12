-- Phase 7: section-scoped assessment moderation; intentionally NO publication,
-- student question delivery, attempts, answer-key projection or score events.
CREATE TYPE "AssessmentReviewDecision" AS ENUM ('APPROVED', 'RETURNED');
CREATE TABLE "AssessmentReviewEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "decision" "AssessmentReviewDecision" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "reviewerMembershipId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentReviewEvent_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "AssessmentReviewEvent_schoolId_draftId_key"
 ON "AssessmentReviewEvent"("schoolId","draftId");
CREATE INDEX "AssessmentReviewEvent_schoolId_createdAt_idx"
 ON "AssessmentReviewEvent"("schoolId","createdAt");
ALTER TABLE "AssessmentReviewEvent"
 ADD CONSTRAINT "AssessmentReviewEvent_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentReviewEvent"
 ADD CONSTRAINT "AssessmentReviewEvent_draft_fkey"
 FOREIGN KEY ("schoolId","draftId") REFERENCES "AssessmentDraft"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentReviewEvent"
 ADD CONSTRAINT "AssessmentReviewEvent_reviewer_fkey"
 FOREIGN KEY ("schoolId","reviewerMembershipId") REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_review_event"()
RETURNS trigger AS $$
DECLARE existing_items INTEGER;
BEGIN
  PERFORM 1 FROM "School" school
    WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for assessment moderation'
      USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM "AssessmentDraft" draft
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact school assessment draft required'
      USING ERRCODE='23503';
  END IF;

  -- Valid release prerequisites include an immutable complete seal and
  -- current active teacher + exact session/term/class/subject assignment.
  -- Role alone, including School Super Admin and Platform Super Admin,
  -- is never a section academic approval override.
  IF NOT EXISTS (
    SELECT 1
    FROM "AssessmentDraft" draft
    JOIN "AssessmentDraftSeal" seal
      ON seal."schoolId"=draft."schoolId" AND seal."draftId"=draft."id"
    JOIN "AcademicSession" period
      ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term
      ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" class
      ON class."schoolId"=draft."schoolId"
      AND class."id"=draft."classId" AND class."isActive"=true
    JOIN "SchoolSection" section
      ON section."schoolId"=draft."schoolId"
      AND section."id"=class."sectionId" AND section."isActive"=true
    JOIN "Subject" subject
      ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher
      ON teacher."schoolId"=draft."schoolId"
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
    JOIN "Membership" reviewer
      ON reviewer."schoolId"=draft."schoolId"
      AND reviewer."id"=NEW."reviewerMembershipId"
      AND reviewer."userId"=NEW."reviewerUserId"
      AND reviewer."isActive"=true
      AND reviewer."role" IN ('HEAD_OF_SECTION','PRINCIPAL')
    JOIN "ScopeGrant" scope
      ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
      AND scope."scopeId"=section."id"
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
      AND (SELECT COUNT(*) FROM "AssessmentDraftQuestion" item
        WHERE item."schoolId"=draft."schoolId"
          AND item."draftId"=draft."id") BETWEEN 1 AND 50
  ) THEN
    RAISE EXCEPTION 'Approval requires sealed exact-section draft and verified reviewer'
      USING ERRCODE='23503';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "AssessmentReviewEvent" earlier
    WHERE earlier."schoolId"=NEW."schoolId" AND earlier."draftId"=NEW."draftId"
  ) THEN
    RAISE EXCEPTION 'Assessment draft already moderated: create new draft snapshot'
      USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AssessmentReviewEvent_validate"
 BEFORE INSERT ON "AssessmentReviewEvent"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_review_event"();
CREATE TRIGGER "AssessmentReviewEvent_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentReviewEvent"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentReviewEvent_no_truncate"
 BEFORE TRUNCATE ON "AssessmentReviewEvent"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

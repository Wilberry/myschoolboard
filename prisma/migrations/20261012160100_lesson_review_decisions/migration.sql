-- Post-enum-commit migration: data constraints and audited review actor checks.
ALTER TABLE "LessonNoteEvent" ADD COLUMN "reason" TEXT;
ALTER TABLE "LessonNoteEvent"
ADD CONSTRAINT "LessonNoteEvent_review_reason_check" CHECK (
  ("eventType" IN ('APPROVED', 'RETURNED')
   AND "reason" IS NOT NULL
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
  OR ("eventType" IN ('CREATED', 'REVISED', 'SUBMITTED')
      AND "reason" IS NULL)
);
ALTER TABLE "LessonNote" DROP CONSTRAINT "LessonNote_submitted_consistency";
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_submitted_consistency" CHECK (
  ("status" = 'DRAFT' AND "submittedAt" IS NULL)
  OR ("status" IN ('SUBMITTED', 'APPROVED', 'RETURNED')
      AND "submittedAt" IS NOT NULL)
);

-- One authoritative review decision per immutable content revision.
-- A RETURNED revision must be edited into a new revision before re-submission.
CREATE UNIQUE INDEX "LessonNoteEvent_one_review_per_revision"
ON "LessonNoteEvent"("schoolId", "noteId", "revisionNumber")
WHERE "eventType" IN ('APPROVED', 'RETURNED');

-- Event actors are matched to their exact relationship and decision type.
-- Reviewer privilege is not satisfied by an arbitrary independent SECTION
-- ID: the note's own active class.sectionId and active section stage match
-- the verified grant of the current active school membership.
CREATE OR REPLACE FUNCTION "validate_lesson_note_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NEW."eventType" IN ('CREATED', 'REVISED', 'SUBMITTED') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "LessonNote" n
      JOIN "Membership" m
        ON m."id" = n."teacherMembershipId"
       AND m."schoolId" = n."schoolId"
      JOIN "School" school ON school."id" = n."schoolId"
      WHERE n."id" = NEW."noteId"
        AND n."schoolId" = NEW."schoolId"
        AND m."id" = NEW."actorMembershipId"
        AND m."userId" = NEW."actorUserId"
        AND m."role" = 'TEACHER'
        AND m."isActive" = true
        AND school."isActive" = true
    ) THEN
      RAISE EXCEPTION 'Lesson author event must belong to an active teacher'
        USING ERRCODE = '23503';
    END IF;
  ELSIF NEW."eventType" IN ('APPROVED', 'RETURNED') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "LessonNote" n
      JOIN "School" school ON school."id" = n."schoolId"
      JOIN "SchoolClass" c
        ON c."id" = n."classId" AND c."schoolId" = n."schoolId"
      JOIN "SchoolSection" section
        ON section."id" = c."sectionId"
       AND section."schoolId" = c."schoolId"
      JOIN "Membership" reviewer
        ON reviewer."id" = NEW."actorMembershipId"
       AND reviewer."schoolId" = n."schoolId"
      JOIN "ScopeGrant" scope_grant
        ON scope_grant."membershipId" = reviewer."id"
       AND scope_grant."type" = 'SECTION'
       AND scope_grant."scopeId" = section."id"
      WHERE n."id" = NEW."noteId"
        AND n."schoolId" = NEW."schoolId"
        AND n."currentRevision" = NEW."revisionNumber"
        AND n."status" = CASE
          WHEN NEW."eventType" = 'APPROVED' THEN 'APPROVED'::"LessonNoteStatus"
          ELSE 'RETURNED'::"LessonNoteStatus"
        END
        AND reviewer."userId" = NEW."actorUserId"
        AND reviewer."isActive" = true
        AND school."isActive" = true
        AND c."isActive" = true
        AND section."isActive" = true
        AND scope_grant."verified" = true
        AND (
          (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
          OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
        )
    ) THEN
      RAISE EXCEPTION 'Lesson reviewer must hold verified section-specific authority'
        USING ERRCODE = '23503';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported lesson event type'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Immutable event/revision triggers from the previous migration stay intact.

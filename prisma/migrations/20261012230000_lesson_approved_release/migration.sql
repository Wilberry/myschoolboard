-- Phase 6 release marker is distinct from approval. Review-only additive
-- migration: no approved note is automatically released.
CREATE TYPE "LessonReleaseEventType" AS ENUM ('RELEASED','WITHDRAWN');
CREATE TABLE "LessonReleaseEvent" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "noteId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "eventType" "LessonReleaseEventType" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonReleaseEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonReleaseEvent_reason_check" CHECK (
    "revisionNumber" > 0 AND char_length(btrim("reason")) BETWEEN 5 AND 500
  )
);
CREATE UNIQUE INDEX "LessonReleaseEvent_schoolId_noteId_revisionNumber_eventType_key"
  ON "LessonReleaseEvent"("schoolId","noteId","revisionNumber","eventType");
CREATE INDEX "LessonReleaseEvent_schoolId_createdAt_idx"
  ON "LessonReleaseEvent"("schoolId","createdAt");
ALTER TABLE "LessonReleaseEvent" ADD CONSTRAINT "LessonReleaseEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonReleaseEvent" ADD CONSTRAINT "LessonReleaseEvent_schoolId_noteId_fkey"
  FOREIGN KEY ("schoolId","noteId") REFERENCES "LessonNote"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonReleaseEvent" ADD CONSTRAINT "LessonReleaseEvent_actor_fkey"
  FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_lesson_release_event"() RETURNS trigger AS $$
BEGIN
  -- Direct writers cannot race current note changes nor manufacture approval.
  PERFORM 1 FROM "School" WHERE "id" = NEW."schoolId" AND "isActive" = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active school required for lesson release' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM "LessonNote" WHERE "id" = NEW."noteId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School note does not exist' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "LessonNote" n
    JOIN "AcademicSession" session ON session."id" = n."sessionId"
      AND session."schoolId" = n."schoolId" AND session."status" = 'ACTIVE'
    JOIN "AcademicTerm" term ON term."id" = n."termId"
      AND term."schoolId" = n."schoolId" AND term."sessionId" = n."sessionId"
      AND term."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = n."classId"
      AND c."schoolId" = n."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "Subject" subject ON subject."id" = n."subjectId"
      AND subject."schoolId" = n."schoolId" AND subject."isActive" = true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."id" = n."assignmentId"
      AND assignment."schoolId" = n."schoolId"
      AND assignment."classId" = n."classId"
      AND assignment."subjectId" = n."subjectId"
      AND assignment."sessionId" = n."sessionId"
      AND assignment."membershipId" = n."teacherMembershipId"
      AND assignment."status" = 'ACTIVE'
    JOIN "Membership" teacher ON teacher."id" = n."teacherMembershipId"
      AND teacher."schoolId" = n."schoolId" AND teacher."isActive" = true
      AND teacher."role" = 'TEACHER'
    JOIN "Membership" reviewer ON reviewer."id" = NEW."actorMembershipId"
      AND reviewer."schoolId" = n."schoolId" AND reviewer."isActive" = true
      AND reviewer."userId" = NEW."actorUserId"
    JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
      AND grant."scopeId" = section."id" AND grant."type" = 'SECTION'
      AND grant."verified" = true
    WHERE n."id" = NEW."noteId" AND n."schoolId" = NEW."schoolId"
      AND n."status" = 'APPROVED'
      AND n."currentRevision" = NEW."revisionNumber"
      AND EXISTS (
        SELECT 1 FROM "LessonNoteRevision" content
        WHERE content."schoolId" = n."schoolId"
          AND content."noteId" = n."id"
          AND content."revisionNumber" = n."currentRevision"
      )
      AND EXISTS (
        SELECT 1 FROM "LessonNoteEvent" approval
        WHERE approval."schoolId" = n."schoolId"
          AND approval."noteId" = n."id"
          AND approval."revisionNumber" = n."currentRevision"
          AND approval."eventType" = 'APPROVED'
      )
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
  ) THEN
    RAISE EXCEPTION 'Lesson release requires approved revision and current exact section reviewer'
      USING ERRCODE='23503';
  END IF;

  IF NEW."eventType" = 'RELEASED' THEN
    IF EXISTS (
      SELECT 1 FROM "LessonReleaseEvent" previous
      WHERE previous."schoolId" = NEW."schoolId"
        AND previous."noteId" = NEW."noteId"
        AND previous."revisionNumber" = NEW."revisionNumber"
    ) THEN
      RAISE EXCEPTION 'Lesson revision already released or withdrawn'
        USING ERRCODE='23505';
    END IF;
  ELSIF NEW."eventType" = 'WITHDRAWN' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "LessonReleaseEvent" previous
      WHERE previous."schoolId" = NEW."schoolId"
        AND previous."noteId" = NEW."noteId"
        AND previous."revisionNumber" = NEW."revisionNumber"
        AND previous."eventType" = 'RELEASED'
    ) OR EXISTS (
      SELECT 1 FROM "LessonReleaseEvent" withdrawn
      WHERE withdrawn."schoolId" = NEW."schoolId"
        AND withdrawn."noteId" = NEW."noteId"
        AND withdrawn."revisionNumber" = NEW."revisionNumber"
        AND withdrawn."eventType" = 'WITHDRAWN'
    ) THEN
      RAISE EXCEPTION 'Only currently released note can be withdrawn'
        USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonReleaseEvent_validate"
  BEFORE INSERT ON "LessonReleaseEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_lesson_release_event"();
CREATE TRIGGER "LessonReleaseEvent_immutable"
  BEFORE UPDATE OR DELETE ON "LessonReleaseEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "LessonReleaseEvent_no_truncate"
  BEFORE TRUNCATE ON "LessonReleaseEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

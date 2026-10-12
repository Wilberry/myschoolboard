-- Draft-only lesson notes. No student visibility or approval/release paths.
-- Existing teacher allocations and academic history remain untouched.
CREATE TYPE "LessonNoteStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "LessonNoteEventType" AS ENUM ('CREATED', 'REVISED', 'SUBMITTED');

-- Make the exact teacher, class, subject and session FK addressable.
CREATE UNIQUE INDEX "TeacherAssignment_lesson_identity"
ON "TeacherClassSubjectAssignment"
("schoolId", "id", "membershipId", "classId", "subjectId", "sessionId");

CREATE TABLE "LessonNote" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "teacherMembershipId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "status" "LessonNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonNote_revision_positive" CHECK ("currentRevision" >= 1),
  CONSTRAINT "LessonNote_submitted_consistency" CHECK (
    ("status" = 'DRAFT' AND "submittedAt" IS NULL)
    OR ("status" = 'SUBMITTED' AND "submittedAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "LessonNote_schoolId_id_key"
ON "LessonNote"("schoolId", "id");
CREATE INDEX "LessonNote_schoolId_termId_status_idx"
ON "LessonNote"("schoolId", "termId", "status");
CREATE INDEX "LessonNote_schoolId_teacherMembershipId_updatedAt_idx"
ON "LessonNote"("schoolId", "teacherMembershipId", "updatedAt");

ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_sessionId_fkey"
FOREIGN KEY ("schoolId", "sessionId")
REFERENCES "AcademicSession"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_sessionId_termId_fkey"
FOREIGN KEY ("schoolId", "sessionId", "termId")
REFERENCES "AcademicTerm"("schoolId", "sessionId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_exact_assignment_fkey"
FOREIGN KEY (
  "schoolId", "assignmentId", "teacherMembershipId",
  "classId", "subjectId", "sessionId"
) REFERENCES "TeacherClassSubjectAssignment"(
  "schoolId", "id", "membershipId", "classId", "subjectId", "sessionId"
) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_teacherMembershipId_fkey"
FOREIGN KEY ("schoolId", "teacherMembershipId")
REFERENCES "Membership"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_classId_fkey"
FOREIGN KEY ("schoolId", "classId")
REFERENCES "SchoolClass"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_schoolId_subjectId_fkey"
FOREIGN KEY ("schoolId", "subjectId")
REFERENCES "Subject"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "LessonNoteRevision" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "topic" TEXT NOT NULL,
  "objectives" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonNoteRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonNoteRevision_positive" CHECK ("revisionNumber" >= 1)
);
CREATE UNIQUE INDEX "LessonNoteRevision_schoolId_noteId_revisionNumber_key"
ON "LessonNoteRevision"("schoolId", "noteId", "revisionNumber");
CREATE INDEX "LessonNoteRevision_schoolId_noteId_createdAt_idx"
ON "LessonNoteRevision"("schoolId", "noteId", "createdAt");
ALTER TABLE "LessonNoteRevision" ADD CONSTRAINT "LessonNoteRevision_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNoteRevision" ADD CONSTRAINT "LessonNoteRevision_schoolId_noteId_fkey"
FOREIGN KEY ("schoolId", "noteId") REFERENCES "LessonNote"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "LessonNoteEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "eventType" "LessonNoteEventType" NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonNoteEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonNoteEvent_positive" CHECK ("revisionNumber" >= 1)
);
CREATE INDEX "LessonNoteEvent_schoolId_noteId_createdAt_idx"
ON "LessonNoteEvent"("schoolId", "noteId", "createdAt");
CREATE INDEX "LessonNoteEvent_schoolId_actorUserId_createdAt_idx"
ON "LessonNoteEvent"("schoolId", "actorUserId", "createdAt");
ALTER TABLE "LessonNoteEvent" ADD CONSTRAINT "LessonNoteEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNoteEvent" ADD CONSTRAINT "LessonNoteEvent_schoolId_noteId_fkey"
FOREIGN KEY ("schoolId", "noteId") REFERENCES "LessonNote"("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- The revision actor must be the note's teacher while it is still draft.
CREATE FUNCTION "validate_lesson_note_revision_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "LessonNote" n
    JOIN "Membership" m
      ON m."id" = n."teacherMembershipId" AND m."schoolId" = n."schoolId"
    WHERE n."id" = NEW."noteId" AND n."schoolId" = NEW."schoolId"
      AND n."status" = 'DRAFT'
      AND m."userId" = NEW."actorUserId"
      AND m."role" = 'TEACHER' AND m."isActive" = true
  ) THEN
    RAISE EXCEPTION 'Lesson revision requires active owning teacher and draft note'
    USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNoteRevision_validate_actor"
BEFORE INSERT ON "LessonNoteRevision"
FOR EACH ROW EXECUTE FUNCTION "validate_lesson_note_revision_actor"();

CREATE FUNCTION "validate_lesson_note_event_actor"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "LessonNote" n
    JOIN "Membership" m
      ON m."id" = n."teacherMembershipId" AND m."schoolId" = n."schoolId"
    WHERE n."id" = NEW."noteId" AND n."schoolId" = NEW."schoolId"
      AND m."id" = NEW."actorMembershipId"
      AND m."userId" = NEW."actorUserId"
      AND m."role" = 'TEACHER' AND m."isActive" = true
  ) THEN
    RAISE EXCEPTION 'Lesson event actor must own an active teacher membership'
    USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNoteEvent_validate_actor"
BEFORE INSERT ON "LessonNoteEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_lesson_note_event_actor"();

CREATE FUNCTION "prevent_lesson_note_history_mutation"() RETURNS trigger AS $$
BEGIN
  -- Existing explicit tenant deletion cascade is separate from ordinary UPDATE
  -- or DELETE; direct history modification must always fail.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Lesson note revisions and events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LessonNoteRevision_immutable"
BEFORE UPDATE OR DELETE ON "LessonNoteRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "LessonNoteEvent_immutable"
BEFORE UPDATE OR DELETE ON "LessonNoteEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();

CREATE FUNCTION "prevent_lesson_note_history_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Lesson note history cannot be truncated';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNoteRevision_no_truncate"
BEFORE TRUNCATE ON "LessonNoteRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "LessonNoteEvent_no_truncate"
BEFORE TRUNCATE ON "LessonNoteEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

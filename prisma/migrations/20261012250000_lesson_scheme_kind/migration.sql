-- Additive Phase 6 typed academic planning documents. Existing lesson
-- notes retain LESSON_NOTE type; no content revision/audit is rewritten.
CREATE TYPE "LessonDocumentKind" AS ENUM ('LESSON_NOTE','SCHEME_OF_WORK');
ALTER TABLE "LessonNote"
  ADD COLUMN "kind" "LessonDocumentKind" NOT NULL DEFAULT 'LESSON_NOTE',
  ADD COLUMN "weekStart" INTEGER,
  ADD COLUMN "weekEnd" INTEGER;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_scheme_week_check"
  CHECK (
    ("kind" = 'LESSON_NOTE' AND "weekStart" IS NULL AND "weekEnd" IS NULL)
    OR
    ("kind" = 'SCHEME_OF_WORK' AND "weekStart" BETWEEN 1 AND 53
       AND "weekEnd" BETWEEN "weekStart" AND 53)
  );
CREATE UNIQUE INDEX "LessonNote_unique_scheme_schedule"
  ON "LessonNote"("schoolId","sessionId","termId","classId","subjectId",
    "weekStart","weekEnd")
  WHERE "kind"='SCHEME_OF_WORK';
-- The note's original school/class/term/subject and document-kind/schedule
-- cannot be rewritten after creation, even by raw SQL.
CREATE FUNCTION "guard_lesson_planning_document_kind"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
    ROW(NEW."kind",NEW."weekStart",NEW."weekEnd") IS DISTINCT FROM
    ROW(OLD."kind",OLD."weekStart",OLD."weekEnd") THEN
    RAISE EXCEPTION 'Lesson planning type and scheme period are immutable'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNote_kind_immutable"
  BEFORE UPDATE ON "LessonNote"
  FOR EACH ROW EXECUTE FUNCTION "guard_lesson_planning_document_kind"();

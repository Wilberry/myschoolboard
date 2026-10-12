-- Phase 6 additive structured schemes of work. Existing notes retain kind
-- LESSON_NOTE, no backfill or historical text rewrite.
CREATE TYPE "LessonMaterialKind" AS ENUM ('LESSON_NOTE','SCHEME_OF_WORK');
ALTER TABLE "LessonNote"
  ADD COLUMN "kind" "LessonMaterialKind" NOT NULL DEFAULT 'LESSON_NOTE';
ALTER TABLE "LessonNoteRevision"
  ADD COLUMN "weeklyPlan" JSONB;

-- Only one scheme draft/review history per exact assignment and academic term.
CREATE UNIQUE INDEX "LessonNote_one_scheme_per_term_assignment"
  ON "LessonNote"("schoolId","termId","assignmentId")
  WHERE "kind" = 'SCHEME_OF_WORK';

CREATE FUNCTION "validate_lesson_weekly_plan"() RETURNS trigger AS $$
DECLARE
  material_kind "LessonMaterialKind";
  item JSONB;
  week_no INTEGER;
  last_week INTEGER := 0;
BEGIN
  SELECT n."kind" INTO material_kind FROM "LessonNote" n
    WHERE n."id" = NEW."noteId" AND n."schoolId" = NEW."schoolId";
  IF material_kind IS NULL THEN
    RAISE EXCEPTION 'Scheme revision needs an exact note' USING ERRCODE='23503';
  END IF;
  IF material_kind = 'LESSON_NOTE' THEN
    IF NEW."weeklyPlan" IS NOT NULL THEN
      RAISE EXCEPTION 'Lesson note must not include a scheme plan'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."weeklyPlan" IS NULL OR
     jsonb_typeof(NEW."weeklyPlan") IS DISTINCT FROM 'array' OR
     jsonb_array_length(NEW."weeklyPlan") NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Scheme requires 1 to 24 weekly topics'
      USING ERRCODE='23514';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW."weeklyPlan") LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
       jsonb_typeof(item->'week') IS DISTINCT FROM 'number' OR
       (item->>'week') !~ '^[0-9]+$' OR
       jsonb_typeof(item->'topic') IS DISTINCT FROM 'string' OR
       jsonb_typeof(item->'objectives') IS DISTINCT FROM 'string' OR
       jsonb_typeof(item->'activities') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid weekly scheme entry fields' USING ERRCODE='23514';
    END IF;
    week_no := (item->>'week')::INTEGER;
    IF week_no <= last_week OR week_no > 24 OR
       char_length(btrim(item->>'topic')) NOT BETWEEN 2 AND 180 OR
       char_length(btrim(item->>'objectives')) NOT BETWEEN 5 AND 4000 OR
       char_length(btrim(item->>'activities')) NOT BETWEEN 5 AND 4000 THEN
      RAISE EXCEPTION 'Invalid, repeated or unsorted scheme week'
        USING ERRCODE='23514';
    END IF;
    last_week := week_no;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNoteRevision_validate_weekly_plan"
  BEFORE INSERT ON "LessonNoteRevision"
  FOR EACH ROW EXECUTE FUNCTION "validate_lesson_weekly_plan"();

-- Kind is a lasting classification; separate release/review events and
-- immutable revisions cannot be repurposed by relabeling existing notes.
CREATE FUNCTION "prevent_lesson_kind_change"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind" THEN
    RAISE EXCEPTION 'Lesson material kind cannot be rewritten'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LessonNote_kind_immutable"
  BEFORE UPDATE ON "LessonNote"
  FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_kind_change"();

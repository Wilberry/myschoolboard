-- Phase 8: explicit school-owned grade-label and rounding policy adoption.
-- New immutable policy versions NEVER recalculate old result packets or
-- publish student report cards. No grade-band defaults are seeded.
CREATE TABLE "ReportGradeScaleRevision" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1,
 "bands" JSONB NOT NULL, "decimalPlaces" INTEGER NOT NULL,
 "roundingMode" VARCHAR(16) NOT NULL,
 "bandBasis" VARCHAR(16) NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportGradeScaleRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReportGradeScaleRevision_policy_check" CHECK (
   "version">=1 AND "decimalPlaces" BETWEEN 0 AND 2
   AND "roundingMode" IN ('HALF_UP','FLOOR','CEILING')
   AND "bandBasis" IN ('RAW_BPS','DISPLAY_ROUNDED_BPS')
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ReportGradeScaleRevision_schoolId_id_key"
 ON "ReportGradeScaleRevision"("schoolId","id");
CREATE UNIQUE INDEX "ReportGradeScaleRevision_schoolId_version_key"
 ON "ReportGradeScaleRevision"("schoolId","version");
CREATE INDEX "ReportGradeScaleRevision_schoolId_adoptedAt_idx"
 ON "ReportGradeScaleRevision"("schoolId","adoptedAt");
ALTER TABLE "ReportGradeScaleRevision"
 ADD CONSTRAINT "ReportGradeScaleRevision_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportGradeScaleRevision"
 ADD CONSTRAINT "ReportGradeScaleRevision_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

-- Fail closed on gaps, overlaps, unordered ranges, bad identifiers, duplicate
-- grade codes, invalid JSON shape, or incomplete 0..10000 score coverage.
-- Ranges use INTEGER basis points, inclusive, never JS floating thresholds.
CREATE FUNCTION "assert_report_grade_scale_bands"(p_bands JSONB)
 RETURNS BOOLEAN AS $$
DECLARE
 item JSONB;
 previous_max INTEGER := -1;
 this_min INTEGER;
 this_max INTEGER;
 code TEXT;
 remark TEXT;
 codes TEXT[] := ARRAY[]::TEXT[];
BEGIN
 IF jsonb_typeof(p_bands) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_bands) NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION 'One to twenty complete grading bands required'
     USING ERRCODE='23514';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_bands) AS entry(value) LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object'
     OR NOT (item ?& ARRAY['code','remark','minBps','maxBps'])
     OR item - 'code' - 'remark' - 'minBps' - 'maxBps' <> '{}'::jsonb
     OR jsonb_typeof(item->'code') IS DISTINCT FROM 'string'
     OR jsonb_typeof(item->'remark') IS DISTINCT FROM 'string'
     OR jsonb_typeof(item->'minBps') IS DISTINCT FROM 'number'
     OR jsonb_typeof(item->'maxBps') IS DISTINCT FROM 'number'
     OR (item->>'minBps') !~ '^[0-9]+$'
     OR (item->>'maxBps') !~ '^[0-9]+$' THEN
     RAISE EXCEPTION 'Invalid grading band structure'
       USING ERRCODE='23514';
   END IF;
   code := item->>'code';
   remark := item->>'remark';
   IF char_length(btrim(code)) NOT BETWEEN 1 AND 16
     OR code<>btrim(code) OR code ~ '[[:cntrl:]]'
     OR char_length(btrim(remark)) NOT BETWEEN 1 AND 120
     OR remark<>btrim(remark) OR remark ~ '[[:cntrl:]]'
     OR lower(code)=ANY(codes) THEN
     RAISE EXCEPTION 'Invalid or duplicated grading labels'
       USING ERRCODE='23514';
   END IF;
   codes := array_append(codes,lower(code));
   -- The lexical integer check above rejects fractional and signed values.
   -- Explicit bounds checked before conversion avoid unsupported score ranges.
   IF length(item->>'minBps')>5 OR length(item->>'maxBps')>5 THEN
     RAISE EXCEPTION 'Band boundaries exceed supported score basis points'
       USING ERRCODE='23514';
   END IF;
   this_min := (item->>'minBps')::INTEGER;
   this_max := (item->>'maxBps')::INTEGER;
   IF this_min<>previous_max+1 OR this_max<this_min OR this_max>10000 THEN
     RAISE EXCEPTION 'Grade bands must be contiguous and ascending'
       USING ERRCODE='23514';
   END IF;
   previous_max := this_max;
 END LOOP;
 IF previous_max<>10000 THEN
   RAISE EXCEPTION 'Grade bands must cover 0 to 10000 inclusive'
     USING ERRCODE='23514';
 END IF;
 RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE FUNCTION "validate_report_grade_scale_revision"()
 RETURNS trigger AS $$
DECLARE
 last_scale RECORD;
 next_version INTEGER;
BEGIN
 PERFORM 1 FROM "School" school
 WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Current active school required' USING ERRCODE='23503';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM "Membership" owner
   WHERE owner."schoolId"=NEW."schoolId"
     AND owner."id"=NEW."actorMembershipId"
     AND owner."userId"=NEW."actorUserId"
     AND owner."isActive"=true AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
   RAISE EXCEPTION 'Only a current same-school owner may adopt grade scales'
     USING ERRCODE='23503';
 END IF;
 PERFORM "assert_report_grade_scale_bands"(NEW."bands");
 SELECT scale."version",scale."bands",scale."decimalPlaces",
   scale."roundingMode",scale."bandBasis" INTO last_scale
 FROM "ReportGradeScaleRevision" scale
 WHERE scale."schoolId"=NEW."schoolId"
 ORDER BY scale."version" DESC LIMIT 1;
 IF last_scale."version" IS NOT NULL
   AND last_scale."bands"=NEW."bands"
   AND last_scale."decimalPlaces"=NEW."decimalPlaces"
   AND last_scale."roundingMode"=NEW."roundingMode"
   AND last_scale."bandBasis"=NEW."bandBasis" THEN
   RAISE EXCEPTION 'Identical grading scale already adopted'
     USING ERRCODE='23505';
 END IF;
 next_version:=COALESCE(last_scale."version",0)+1;
 NEW."version":=next_version;
 NEW."adoptedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportGradeScaleRevision_validate"
 BEFORE INSERT ON "ReportGradeScaleRevision"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_grade_scale_revision"();
CREATE TRIGGER "ReportGradeScaleRevision_immutable"
 BEFORE UPDATE OR DELETE ON "ReportGradeScaleRevision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportGradeScaleRevision_no_truncate"
 BEFORE TRUNCATE ON "ReportGradeScaleRevision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

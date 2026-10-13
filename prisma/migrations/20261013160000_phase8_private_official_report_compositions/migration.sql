-- Phase 8: privately frozen official-grade composition EVIDENCE ONLY.
-- No report release / access grant / student or guardian API / export.
-- No trusted caller-supplied grade values, student IDs, marks or versions.

CREATE TABLE "PrivateOfficialReportComposition" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "sourcePacketId" TEXT NOT NULL, "finalDecisionId" TEXT NOT NULL,
 "evidenceId" TEXT NOT NULL, "adoptionId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
 "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "evidenceRevision" INTEGER NOT NULL DEFAULT 1,
 "aggregationRuleId" TEXT NOT NULL, "aggregationRuleVersion" INTEGER NOT NULL DEFAULT 1,
 "gradeScaleId" TEXT NOT NULL, "gradeScaleVersion" INTEGER NOT NULL DEFAULT 1,
 "studentCount" INTEGER NOT NULL DEFAULT 0,
 "composedStudentCards" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "status" VARCHAR(64) NOT NULL DEFAULT 'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED',
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "composedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PrivateOfficialReportComposition_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PrivateOfficialReportComposition_integrity_check" CHECK (
   "evidenceRevision">=1 AND "aggregationRuleVersion">=1
   AND "gradeScaleVersion">=1 AND "studentCount" BETWEEN 1 AND 500
   AND jsonb_typeof("composedStudentCards")='array'
   AND jsonb_array_length("composedStudentCards")="studentCount"
   AND "status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "PrivateOfficialReportComposition_schoolId_id_key"
 ON "PrivateOfficialReportComposition"("schoolId","id");
CREATE UNIQUE INDEX "PrivateOfficialReportComposition_schoolId_sourcePacketId_key"
 ON "PrivateOfficialReportComposition"("schoolId","sourcePacketId");
CREATE INDEX "PrivateOfficialReportComposition_schoolId_composedAt_idx"
 ON "PrivateOfficialReportComposition"("schoolId","composedAt");
ALTER TABLE "PrivateOfficialReportComposition"
 ADD CONSTRAINT "PrivateOfficialReportComposition_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateOfficialReportComposition"
 ADD CONSTRAINT "PrivateOfficialReportComposition_packet_fkey"
 FOREIGN KEY ("schoolId","sourcePacketId")
 REFERENCES "ResultReportCardSourcePacket"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PrivateOfficialReportComposition"
 ADD CONSTRAINT "PrivateOfficialReportComposition_aggregation_fkey"
 FOREIGN KEY ("schoolId","aggregationRuleId")
 REFERENCES "ReportAggregationRuleRevision"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PrivateOfficialReportComposition"
 ADD CONSTRAINT "PrivateOfficialReportComposition_scale_fkey"
 FOREIGN KEY ("schoolId","gradeScaleId")
 REFERENCES "ReportGradeScaleRevision"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PrivateOfficialReportComposition"
 ADD CONSTRAINT "PrivateOfficialReportComposition_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- All inputs are nonnegative integers or exact NUMERIC expressions. This
-- implements the same explicit precision modes as the private TS simulator.
CREATE FUNCTION "round_report_fraction"(
 numerator NUMERIC, denominator NUMERIC, precision_mode TEXT
) RETURNS INTEGER AS $$
DECLARE result NUMERIC;
BEGIN
 IF numerator IS NULL OR numerator<0 OR denominator IS NULL
   OR denominator<=0 OR precision_mode IS NULL
   OR precision_mode NOT IN ('HALF_UP','FLOOR','CEILING') THEN
   RAISE EXCEPTION 'Invalid report fraction' USING ERRCODE='23514';
 END IF;
 IF precision_mode='FLOOR' THEN result:=floor(numerator/denominator);
 ELSIF precision_mode='CEILING' THEN result:=ceil(numerator/denominator);
 ELSE result:=floor(numerator/denominator+0.5); END IF;
 IF result<0 OR result>10000 THEN
   RAISE EXCEPTION 'Report basis points out of range' USING ERRCODE='23514';
 END IF;
 RETURN result::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Only callable from a private locked insert. Explicitly verify every pupil,
-- source ID, score, adopted weight and grade band; fail closed on bad JSON.
CREATE FUNCTION "build_private_official_report_cards"(
 source_cards JSONB, expected_count INTEGER,
 weight_version INTEGER, quiz_weight INTEGER, test_weight INTEGER,
 exam_weight INTEGER, method TEXT, precision_mode TEXT,
 bands JSONB, decimal_places INTEGER, rounding_mode TEXT, band_basis TEXT
) RETURNS JSONB AS $$
DECLARE
 pupil JSONB;
 entry RECORD;
 mark JSONB;
 marks JSONB;
 mark_id TEXT;
 earned_text TEXT;
 max_text TEXT;
 earned_value NUMERIC;
 max_value NUMERIC;
 source_ids TEXT[];
 pupil_ids TEXT[] := ARRAY[]::TEXT[];
 category TEXT;
 weight INTEGER;
 item JSONB;
 n INTEGER;
 earned_total NUMERIC;
 possible_total NUMERIC;
 normalized_total NUMERIC;
 category_bps INTEGER;
 quiz_bps INTEGER;
 test_bps INTEGER;
 exam_bps INTEGER;
 weighted_total NUMERIC;
 raw_bps INTEGER;
 rounding_unit INTEGER;
 rounded_bps INTEGER;
 grade_basis INTEGER;
 found_band JSONB;
 grade_code TEXT;
 grade_remark TEXT;
 display_text TEXT;
 results JSONB := '[]'::jsonb;
BEGIN
 IF jsonb_typeof(source_cards) IS DISTINCT FROM 'array'
   OR expected_count NOT BETWEEN 1 AND 500
   OR jsonb_array_length(source_cards)<>expected_count
   OR weight_version IS NULL OR weight_version<1
   OR quiz_weight IS NULL OR test_weight IS NULL OR exam_weight IS NULL
   OR quiz_weight NOT BETWEEN 0 AND 100 OR test_weight NOT BETWEEN 0 AND 100
   OR exam_weight NOT BETWEEN 0 AND 100
   OR quiz_weight+test_weight+exam_weight<>100
   OR method IS NULL
   OR method NOT IN ('EQUAL_ASSESSMENT_BPS','POOLED_CATEGORY_POINTS')
   OR precision_mode IS NULL
   OR precision_mode NOT IN ('HALF_UP','FLOOR','CEILING')
   OR decimal_places IS NULL OR decimal_places NOT BETWEEN 0 AND 2
   OR rounding_mode IS NULL
   OR rounding_mode NOT IN ('HALF_UP','FLOOR','CEILING')
   OR band_basis IS NULL
   OR band_basis NOT IN ('RAW_BPS','DISPLAY_ROUNDED_BPS') THEN
    RAISE EXCEPTION 'Complete explicit report policies required'
      USING ERRCODE='23514';
 END IF;
 PERFORM "assert_report_grade_scale_bands"(bands);
 rounding_unit:=CASE decimal_places WHEN 0 THEN 100 WHEN 1 THEN 10 ELSE 1 END;
 FOR pupil IN SELECT value FROM jsonb_array_elements(source_cards) AS s(value)
   ORDER BY value->>'studentId' LOOP
   IF jsonb_typeof(pupil) IS DISTINCT FROM 'object'
     OR coalesce(pupil->>'studentId','')=''
     OR pupil->>'studentId'=ANY(pupil_ids)
     OR pupil->>'reportStatus'<>'INTERNAL_SOURCE_ONLY_NOT_RELEASED'
     OR pupil->>'adoptedWeightVersion' IS DISTINCT FROM weight_version::TEXT
     OR pupil->>'quizWeight' IS DISTINCT FROM quiz_weight::TEXT
     OR pupil->>'testWeight' IS DISTINCT FROM test_weight::TEXT
     OR pupil->>'examWeight' IS DISTINCT FROM exam_weight::TEXT
     OR jsonb_typeof(pupil->'cbt') IS DISTINCT FROM 'array'
     OR jsonb_typeof(pupil->'manual') IS DISTINCT FROM 'array' THEN
     RAISE EXCEPTION 'Inconsistent frozen pupil grading evidence'
       USING ERRCODE='23514';
   END IF;
   pupil_ids:=array_append(pupil_ids,pupil->>'studentId');
   marks:='[]'::jsonb;
   source_ids:=ARRAY[]::TEXT[];
   FOR entry IN
     SELECT 'CBT'::TEXT AS origin,value AS item
       FROM jsonb_array_elements(pupil->'cbt') AS s(value)
     UNION ALL
     SELECT 'MANUAL'::TEXT AS origin,value AS item
       FROM jsonb_array_elements(pupil->'manual') AS s(value)
   LOOP
     mark:=entry.item;
     IF jsonb_typeof(mark) IS DISTINCT FROM 'object' THEN
       RAISE EXCEPTION 'Malformed frozen source mark' USING ERRCODE='23514';
     END IF;
     IF entry.origin='CBT' THEN
       mark_id:='CBT:'||coalesce(mark->>'draftId','');
       earned_text:=mark->>'earnedPoints';
       IF coalesce(mark->>'attemptId','')='' THEN
         RAISE EXCEPTION 'Missing scored CBT attempt' USING ERRCODE='23514';
       END IF;
       IF jsonb_typeof(mark->'earnedPoints') IS DISTINCT FROM 'number' THEN
         RAISE EXCEPTION 'Invalid CBT earned points' USING ERRCODE='23514';
       END IF;
     ELSE
       mark_id:='MANUAL:'||coalesce(mark->>'componentId','');
       earned_text:=mark->>'effectivePoints';
       IF coalesce(mark->>'markId','')='' THEN
         RAISE EXCEPTION 'Missing reviewed written mark' USING ERRCODE='23514';
       END IF;
       IF jsonb_typeof(mark->'effectivePoints') IS DISTINCT FROM 'number' THEN
         RAISE EXCEPTION 'Invalid written earned points' USING ERRCODE='23514';
       END IF;
     END IF;
     max_text:=mark->>'maxPoints';
     IF mark_id IN ('CBT:','MANUAL:') OR mark_id=ANY(source_ids)
       OR coalesce(mark->>'kind','') NOT IN ('QUIZ','TEST','EXAM')
       OR jsonb_typeof(mark->'maxPoints') IS DISTINCT FROM 'number'
       OR earned_text IS NULL OR earned_text !~ '^[0-9]{1,10}$'
       OR max_text IS NULL OR max_text !~ '^[0-9]{1,10}$' THEN
       RAISE EXCEPTION 'Duplicate, noninteger or missing assessment source'
         USING ERRCODE='23514';
     END IF;
     earned_value:=earned_text::NUMERIC;
     max_value:=max_text::NUMERIC;
     IF max_value<=0 OR earned_value>max_value THEN
       RAISE EXCEPTION 'Assessment points exceed valid source range'
         USING ERRCODE='23514';
     END IF;
     source_ids:=array_append(source_ids,mark_id);
     marks:=marks||jsonb_build_array(jsonb_build_object(
       'kind',mark->>'kind','earned',earned_value,'max',max_value));
   END LOOP;
   quiz_bps:=NULL; test_bps:=NULL; exam_bps:=NULL;
   weighted_total:=0;
   FOR category IN SELECT unnest(ARRAY['QUIZ','TEST','EXAM']) LOOP
     weight:=CASE category WHEN 'QUIZ' THEN quiz_weight
       WHEN 'TEST' THEN test_weight ELSE exam_weight END;
     n:=0; earned_total:=0; possible_total:=0; normalized_total:=0;
     FOR item IN SELECT value FROM jsonb_array_elements(marks) AS s(value)
       WHERE value->>'kind'=category LOOP
       n:=n+1;
       earned_total:=earned_total+(item->>'earned')::NUMERIC;
       possible_total:=possible_total+(item->>'max')::NUMERIC;
       IF method='EQUAL_ASSESSMENT_BPS' THEN
         normalized_total:=normalized_total+
           "round_report_fraction"((item->>'earned')::NUMERIC*10000,
             (item->>'max')::NUMERIC,precision_mode);
       END IF;
     END LOOP;
     IF n=0 THEN
       IF weight>0 THEN
         RAISE EXCEPTION 'Missing positive-weight pupil assessment category'
           USING ERRCODE='23514';
       END IF;
     ELSE
       IF method='EQUAL_ASSESSMENT_BPS' THEN
         category_bps:="round_report_fraction"(normalized_total,n,precision_mode);
       ELSE
         category_bps:="round_report_fraction"(earned_total*10000,
           possible_total,precision_mode);
       END IF;
       IF category='QUIZ' THEN quiz_bps:=category_bps;
       ELSIF category='TEST' THEN test_bps:=category_bps;
       ELSE exam_bps:=category_bps; END IF;
       weighted_total:=weighted_total+weight*category_bps;
     END IF;
   END LOOP;
   raw_bps:="round_report_fraction"(weighted_total,100,precision_mode);
   rounded_bps:="round_report_fraction"(raw_bps,rounding_unit,rounding_mode)
     * rounding_unit;
   grade_basis:=CASE WHEN band_basis='RAW_BPS' THEN raw_bps ELSE rounded_bps END;
   SELECT value INTO found_band FROM jsonb_array_elements(bands) AS b(value)
   WHERE grade_basis BETWEEN (value->>'minBps')::INTEGER
     AND (value->>'maxBps')::INTEGER LIMIT 1;
   IF found_band IS NULL THEN
     RAISE EXCEPTION 'Missing adopted grade band for composed score'
       USING ERRCODE='23514';
   END IF;
   grade_code:=found_band->>'code'; grade_remark:=found_band->>'remark';
   -- Force explicit decimal digits, independent of Postgres numeric display
   -- scale or server locale.
   display_text:=(rounded_bps/100)::INTEGER::TEXT;
   IF decimal_places>0 THEN
     display_text:=floor(rounded_bps/100)::INTEGER::TEXT||'.'||
       lpad((rounded_bps%100 / rounding_unit)::INTEGER::TEXT,
         decimal_places,'0');
   END IF;
   results:=results||jsonb_build_array(jsonb_build_object(
     'studentId',pupil->>'studentId',
     'rawPercentBps',raw_bps,'displayPercent',display_text,
     'gradeCode',grade_code,'remark',grade_remark,
     'categoryPercentBps',jsonb_build_object(
       'QUIZ',quiz_bps,'TEST',test_bps,'EXAM',exam_bps),
     'reportStatus','INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'));
 END LOOP;
 IF jsonb_array_length(results)<>expected_count THEN
   RAISE EXCEPTION 'Incomplete frozen class report composition'
     USING ERRCODE='23514';
 END IF;
 RETURN results;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_private_official_report_composition"()
 RETURNS trigger AS $$
DECLARE
 snapshot RECORD;
 aggregation RECORD;
 scale RECORD;
 weights RECORD;
 cards JSONB;
BEGIN
 SELECT packet."finalDecisionId",packet."evidenceId",packet."adoptionId",
   packet."sessionId",packet."termId",packet."classId",packet."subjectId",
   packet."evidenceRevision",packet."studentCount",packet."studentSourceCards"
 INTO snapshot FROM "ResultReportCardSourcePacket" packet
 WHERE packet."schoolId"=NEW."schoolId" AND packet."id"=NEW."sourcePacketId";
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Current approved frozen source packet required'
     USING ERRCODE='23503';
 END IF;
 -- This obtains the school FOR UPDATE lock and checks the current exact
 -- owner, original assigned teacher, independent section reviewer, current
 -- adopted category weights and recomputed complete identical pupil sources.
 PERFORM "assert_result_publication_readiness"(
   NEW."schoolId",snapshot."evidenceId",
   NEW."actorMembershipId",NEW."actorUserId");
 -- Explicit *current* school-adopted policy versions are mandatory. No
 -- latest-policy fallback and no substitution with browser grade values.
 SELECT a."id",a."version",a."categoryMethod",a."precisionMode"
 INTO aggregation FROM "ReportAggregationRuleRevision" a
 WHERE a."schoolId"=NEW."schoolId" AND a."id"=NEW."aggregationRuleId";
 IF NOT FOUND OR aggregation."version" IS DISTINCT FROM (
   SELECT max(x."version") FROM "ReportAggregationRuleRevision" x
   WHERE x."schoolId"=NEW."schoolId") THEN
   RAISE EXCEPTION 'Explicit current aggregation revision required'
     USING ERRCODE='23505';
 END IF;
 SELECT g."id",g."version",g."bands",g."decimalPlaces",
   g."roundingMode",g."bandBasis" INTO scale
 FROM "ReportGradeScaleRevision" g
 WHERE g."schoolId"=NEW."schoolId" AND g."id"=NEW."gradeScaleId";
 IF NOT FOUND OR scale."version" IS DISTINCT FROM (
   SELECT max(x."version") FROM "ReportGradeScaleRevision" x
   WHERE x."schoolId"=NEW."schoolId") THEN
   RAISE EXCEPTION 'Explicit current report grade scale required'
     USING ERRCODE='23505';
 END IF;
 SELECT policy."version",policy."quizWeight",policy."testWeight",
   policy."examWeight" INTO weights
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" policy
   ON policy."schoolId"=adoption."schoolId"
   AND policy."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
   AND adoption."id"=snapshot."adoptionId";
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Exact school-adopted assessment weighting missing'
     USING ERRCODE='23503';
 END IF;
 IF EXISTS (SELECT 1 FROM "PrivateOfficialReportComposition" earlier
   WHERE earlier."schoolId"=NEW."schoolId"
     AND earlier."sourcePacketId"=NEW."sourcePacketId") THEN
   RAISE EXCEPTION 'Source packet already composed into immutable evidence'
     USING ERRCODE='23505';
 END IF;
 cards:="build_private_official_report_cards"(
   snapshot."studentSourceCards",snapshot."studentCount",
   weights."version",weights."quizWeight",weights."testWeight",
   weights."examWeight",aggregation."categoryMethod",
   aggregation."precisionMode",scale."bands",scale."decimalPlaces",
   scale."roundingMode",scale."bandBasis");
 NEW."finalDecisionId":=snapshot."finalDecisionId";
 NEW."evidenceId":=snapshot."evidenceId";
 NEW."adoptionId":=snapshot."adoptionId";
 NEW."sessionId":=snapshot."sessionId";
 NEW."termId":=snapshot."termId";
 NEW."classId":=snapshot."classId";
 NEW."subjectId":=snapshot."subjectId";
 NEW."evidenceRevision":=snapshot."evidenceRevision";
 NEW."aggregationRuleVersion":=aggregation."version";
 NEW."gradeScaleVersion":=scale."version";
 NEW."studentCount":=snapshot."studentCount";
 NEW."composedStudentCards":=cards;
 NEW."status":='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED';
 NEW."composedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PrivateOfficialReportComposition_validate"
 BEFORE INSERT ON "PrivateOfficialReportComposition"
 FOR EACH ROW EXECUTE FUNCTION "validate_private_official_report_composition"();
CREATE TRIGGER "PrivateOfficialReportComposition_immutable"
 BEFORE UPDATE OR DELETE ON "PrivateOfficialReportComposition"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "PrivateOfficialReportComposition_no_truncate"
 BEFORE TRUNCATE ON "PrivateOfficialReportComposition"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

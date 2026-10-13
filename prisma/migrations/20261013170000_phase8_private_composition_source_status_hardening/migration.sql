-- Forward-only migration: harden the existing private report composer.
-- PostgreSQL NULL semantics: NULL <> 'expected' yields NULL, and an IF with
-- otherwise false OR terms will not reject a missing source-status field.
-- IS DISTINCT FROM is explicitly true for missing, JSON null, or altered
-- source statuses. Preserve the previous function signature and all immutable
-- result constraints; do not rewrite migration 20261013160000 if deployed.
-- No recipients, public result access, exports or publication are enabled.

CREATE OR REPLACE FUNCTION "build_private_official_report_cards"(
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
   OR expected_count IS NULL OR expected_count NOT BETWEEN 1 AND 500
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
     OR pupil->>'reportStatus' IS DISTINCT FROM 'INTERNAL_SOURCE_ONLY_NOT_RELEASED'
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

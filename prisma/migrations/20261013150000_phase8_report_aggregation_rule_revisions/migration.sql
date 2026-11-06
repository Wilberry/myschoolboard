-- Phase 8: explicit versioned School Super Admin aggregation policy.
-- No defaults, no computed official reports, no public/student result access.
-- Independent of both per-class adopted QUIZ/TEST/EXAM category weights and
-- the school-wide adopted report grade-label/rounding revision.
CREATE TABLE "ReportAggregationRuleRevision" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1,
 "categoryMethod" VARCHAR(32) NOT NULL,
 "precisionMode" VARCHAR(16) NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportAggregationRuleRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReportAggregationRuleRevision_policy_check" CHECK (
   "version">=1
   AND "categoryMethod" IN ('EQUAL_ASSESSMENT_BPS','POOLED_CATEGORY_POINTS')
   AND "precisionMode" IN ('HALF_UP','FLOOR','CEILING')
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ReportAggregationRuleRevision_schoolId_id_key"
 ON "ReportAggregationRuleRevision"("schoolId","id");
CREATE UNIQUE INDEX "ReportAggregationRuleRevision_schoolId_version_key"
 ON "ReportAggregationRuleRevision"("schoolId","version");
CREATE INDEX "ReportAggregationRuleRevision_schoolId_adoptedAt_idx"
 ON "ReportAggregationRuleRevision"("schoolId","adoptedAt");
ALTER TABLE "ReportAggregationRuleRevision"
 ADD CONSTRAINT "ReportAggregationRuleRevision_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportAggregationRuleRevision"
 ADD CONSTRAINT "ReportAggregationRuleRevision_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_report_aggregation_rule_revision"()
 RETURNS trigger AS $$
DECLARE previous RECORD;
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
   RAISE EXCEPTION 'Current exact same-school owner required'
     USING ERRCODE='23503';
 END IF;
 SELECT rule."version",rule."categoryMethod",rule."precisionMode"
 INTO previous FROM "ReportAggregationRuleRevision" rule
 WHERE rule."schoolId"=NEW."schoolId"
 ORDER BY rule."version" DESC LIMIT 1;
 IF previous."version" IS NOT NULL
   AND previous."categoryMethod"=NEW."categoryMethod"
   AND previous."precisionMode"=NEW."precisionMode" THEN
   RAISE EXCEPTION 'Identical category aggregation policy already adopted'
     USING ERRCODE='23505';
 END IF;
 NEW."version":=COALESCE(previous."version",0)+1;
 NEW."adoptedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportAggregationRuleRevision_validate"
 BEFORE INSERT ON "ReportAggregationRuleRevision"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_aggregation_rule_revision"();
CREATE TRIGGER "ReportAggregationRuleRevision_immutable"
 BEFORE UPDATE OR DELETE ON "ReportAggregationRuleRevision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportAggregationRuleRevision_no_truncate"
 BEFORE TRUNCATE ON "ReportAggregationRuleRevision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

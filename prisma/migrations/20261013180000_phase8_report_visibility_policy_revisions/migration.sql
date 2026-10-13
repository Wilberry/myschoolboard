-- Phase 8: append-only school-adopted FUTURE report-audience intention.
-- These policy values are not result releases or reading entitlements.
-- No student/guardian query, relationship grant, publication or export added.
-- No seeded default: until a school explicitly adopts a policy the future
-- report visibility decision must fail closed as configuration-missing.

CREATE TABLE "ReportVisibilityPolicyRevision" (
 "id" TEXT NOT NULL,
 "schoolId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1,
 "recipientMode" VARCHAR(48) NOT NULL,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReportVisibilityPolicyRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReportVisibilityPolicyRevision_integrity_check" CHECK (
   "version">=1
   AND "recipientMode" IN (
     'ASSESSMENT_ONLY',
     'GUARDIAN_AFTER_RELEASE',
     'STUDENT_AFTER_RELEASE',
     'GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   AND char_length(btrim("reason")) BETWEEN 5 AND 500
   AND "reason"=btrim("reason"))
);
CREATE UNIQUE INDEX "ReportVisibilityPolicyRevision_schoolId_id_key"
 ON "ReportVisibilityPolicyRevision"("schoolId","id");
CREATE UNIQUE INDEX "ReportVisibilityPolicyRevision_schoolId_version_key"
 ON "ReportVisibilityPolicyRevision"("schoolId","version");
CREATE INDEX "ReportVisibilityPolicyRevision_schoolId_adoptedAt_idx"
 ON "ReportVisibilityPolicyRevision"("schoolId","adoptedAt");
ALTER TABLE "ReportVisibilityPolicyRevision"
 ADD CONSTRAINT "ReportVisibilityPolicyRevision_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportVisibilityPolicyRevision"
 ADD CONSTRAINT "ReportVisibilityPolicyRevision_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_report_visibility_policy_revision"()
 RETURNS trigger AS $$
DECLARE
 previous RECORD;
BEGIN
 -- A single school row lock serializes policy revision ordinals with other
 -- tenant authorization changes. A policy event cannot publish any grade.
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
     AND owner."isActive"=true
     AND owner."role"='SCHOOL_SUPER_ADMIN'
 ) THEN
   RAISE EXCEPTION 'Current same-school Super Admin required'
     USING ERRCODE='23503';
 END IF;
 SELECT p."version",p."recipientMode" INTO previous
 FROM "ReportVisibilityPolicyRevision" p
 WHERE p."schoolId"=NEW."schoolId"
 ORDER BY p."version" DESC LIMIT 1;
 IF previous."version" IS NOT NULL
    AND previous."recipientMode"=NEW."recipientMode" THEN
   RAISE EXCEPTION 'Identical visibility policy already adopted'
     USING ERRCODE='23505';
 END IF;
 NEW."version":=COALESCE(previous."version",0)+1;
 NEW."adoptedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportVisibilityPolicyRevision_validate"
 BEFORE INSERT ON "ReportVisibilityPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_visibility_policy_revision"();
CREATE TRIGGER "ReportVisibilityPolicyRevision_immutable"
 BEFORE UPDATE OR DELETE ON "ReportVisibilityPolicyRevision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportVisibilityPolicyRevision_no_truncate"
 BEFORE TRUNCATE ON "ReportVisibilityPolicyRevision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

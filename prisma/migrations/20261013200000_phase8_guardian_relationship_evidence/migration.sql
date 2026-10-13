-- Phase 8: school-attested guardian/student relationship evidence, NOT
-- result publication, parent-first acknowledgment or report access.
-- Never infer a guardian from surname/email/admission number or mere PARENT role.
-- Existing STUDENT account links remain separately verified/revocable.
CREATE TABLE "GuardianStudentRelationshipEvent" (
 "id" TEXT NOT NULL,
 "schoolId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL,
 "guardianMembershipId" TEXT NOT NULL,
 "ordinal" INTEGER NOT NULL DEFAULT 1,
 "action" VARCHAR(16) NOT NULL,
 "evidenceReviewed" BOOLEAN NOT NULL DEFAULT false,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GuardianStudentRelationshipEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "GuardianStudentRelationshipEvent_content_check" CHECK (
   "ordinal">=1
   AND "action" IN ('VERIFY','REVOKE')
   AND "evidenceReviewed"=("action"='VERIFY')
   AND char_length(btrim("reason")) BETWEEN 5 AND 500
   AND "reason"=btrim("reason"))
);
CREATE UNIQUE INDEX "GuardianStudentRelationshipEvent_schoolId_id_key"
 ON "GuardianStudentRelationshipEvent"("schoolId","id");
CREATE UNIQUE INDEX "GuardianStudentRelationshipEvent_pair_ordinal_key"
 ON "GuardianStudentRelationshipEvent"(
  "schoolId","studentId","guardianMembershipId","ordinal");
CREATE INDEX "GuardianStudentRelationshipEvent_pair_recordedAt_idx"
 ON "GuardianStudentRelationshipEvent"(
  "schoolId","studentId","guardianMembershipId","recordedAt");
ALTER TABLE "GuardianStudentRelationshipEvent"
 ADD CONSTRAINT "GuardianStudentRelationshipEvent_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentRelationshipEvent"
 ADD CONSTRAINT "GuardianStudentRelationshipEvent_student_fkey"
 FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentRelationshipEvent"
 ADD CONSTRAINT "GuardianStudentRelationshipEvent_guardian_fkey"
 FOREIGN KEY ("schoolId","guardianMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentRelationshipEvent"
 ADD CONSTRAINT "GuardianStudentRelationshipEvent_actor_fkey"
 FOREIGN KEY ("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_guardian_student_relationship_event"()
 RETURNS trigger AS $$
DECLARE
 previous RECORD;
BEGIN
 -- School lock ensures sequential immutable relationship decisions and
 -- serialization with current owner/school authorization events.
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
   RAISE EXCEPTION 'Exact current School Super Admin required'
     USING ERRCODE='23503';
 END IF;
 -- The subject MUST be an exact existing same-school PARENT membership,
 -- including after a revocation (so inactivity never prevents revoking).
 IF NOT EXISTS (
   SELECT 1 FROM "Membership" guardian
   WHERE guardian."schoolId"=NEW."schoolId"
     AND guardian."id"=NEW."guardianMembershipId"
     AND (NEW."action"='REVOKE' OR guardian."role"='PARENT')
 ) OR NOT EXISTS (
   SELECT 1 FROM "StudentRecord" student
   WHERE student."schoolId"=NEW."schoolId"
     AND student."id"=NEW."studentId"
 ) THEN
   RAISE EXCEPTION 'Exact same-school parent membership and pupil required'
     USING ERRCODE='23503';
 END IF;
 IF NEW."action"='VERIFY' AND NOT EXISTS (
   SELECT 1 FROM "StudentRecord" student
   JOIN "StudentEnrollment" enrollment
     ON enrollment."schoolId"=student."schoolId"
     AND enrollment."studentId"=student."id"
     AND enrollment."status"='ACTIVE'
   JOIN "Membership" guardian
     ON guardian."schoolId"=student."schoolId"
     AND guardian."id"=NEW."guardianMembershipId"
     AND guardian."role"='PARENT'
     AND guardian."isActive"=true
   JOIN "User" guardian_user
     ON guardian_user."id"=guardian."userId"
     AND guardian_user."emailVerified"=true
   WHERE student."schoolId"=NEW."schoolId"
     AND student."id"=NEW."studentId"
     AND student."status"='ENROLLED'
 ) THEN
   RAISE EXCEPTION 'Verification requires enrolled pupil and active verified parent identity'
     USING ERRCODE='23503';
 END IF;
 SELECT event."ordinal",event."action" INTO previous
 FROM "GuardianStudentRelationshipEvent" event
 WHERE event."schoolId"=NEW."schoolId"
   AND event."studentId"=NEW."studentId"
   AND event."guardianMembershipId"=NEW."guardianMembershipId"
 ORDER BY event."ordinal" DESC LIMIT 1;
 IF (previous."ordinal" IS NULL AND NEW."action"<>'VERIFY')
   OR (previous."ordinal" IS NOT NULL AND previous."action"=NEW."action") THEN
   RAISE EXCEPTION 'Relationship verification or revocation transition not allowed'
     USING ERRCODE='23505';
 END IF;
 NEW."ordinal":=COALESCE(previous."ordinal",0)+1;
 -- Flag is derived from an explicit verified transition, not client data.
 NEW."evidenceReviewed":=(NEW."action"='VERIFY');
 NEW."recordedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GuardianStudentRelationshipEvent_validate"
 BEFORE INSERT ON "GuardianStudentRelationshipEvent"
 FOR EACH ROW EXECUTE FUNCTION "validate_guardian_student_relationship_event"();
CREATE TRIGGER "GuardianStudentRelationshipEvent_immutable"
 BEFORE UPDATE OR DELETE ON "GuardianStudentRelationshipEvent"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "GuardianStudentRelationshipEvent_no_truncate"
 BEFORE TRUNCATE ON "GuardianStudentRelationshipEvent"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

-- DB-only, owner-checked diagnostic; NOT a report authorization function.
-- Return only NO_VERIFIED_RELATIONSHIP_OR_POLICY or
-- RELATIONSHIP_VERIFIED_NOT_RELEASED (never scores, names or cards).
-- EVERY eventual student/guardian report read must separately verify a
-- current audited release and adopted policy with parent-first P-004 resolved.
CREATE FUNCTION "inspect_private_report_recipient_relationship"(
 p_school TEXT,p_composition TEXT,p_student TEXT,p_recipient_member TEXT,
 p_actor_membership TEXT,p_actor_user TEXT
) RETURNS TEXT AS $$
DECLARE
 snapshot RECORD;
 visibility TEXT;
 recipient RECORD;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM "School" school
   JOIN "Membership" owner ON owner."schoolId"=school."id"
     AND owner."id"=p_actor_membership
     AND owner."userId"=p_actor_user
     AND owner."isActive"=true
     AND owner."role"='SCHOOL_SUPER_ADMIN'
   WHERE school."id"=p_school AND school."isActive"=true
 ) THEN
   RAISE EXCEPTION 'Current exact school owner required'
     USING ERRCODE='23503';
 END IF;
 SELECT comp."schoolId",comp."sessionId",comp."classId",
   comp."composedStudentCards" INTO snapshot
 FROM "PrivateOfficialReportComposition" comp
 WHERE comp."schoolId"=p_school
   AND comp."id"=p_composition
   AND comp."status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED';
 IF NOT FOUND THEN
   RETURN 'NO_VERIFIED_RELATIONSHIP_OR_POLICY';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM "StudentRecord" student
   JOIN "StudentEnrollment" enrollment
     ON enrollment."schoolId"=student."schoolId"
     AND enrollment."studentId"=student."id"
     AND enrollment."classId"=snapshot."classId"
     AND enrollment."sessionId"=snapshot."sessionId"
     AND enrollment."status"='ACTIVE'
   WHERE student."schoolId"=p_school AND student."id"=p_student
     AND student."status"='ENROLLED'
 ) OR NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(
     coalesce(snapshot."composedStudentCards",'[]'::jsonb)
   ) AS card(value) WHERE card.value->>'studentId'=p_student
 ) THEN
   RETURN 'NO_VERIFIED_RELATIONSHIP_OR_POLICY';
 END IF;
 SELECT policy."recipientMode" INTO visibility
 FROM "ReportVisibilityPolicyRevision" policy
 WHERE policy."schoolId"=p_school
 ORDER BY policy."version" DESC LIMIT 1;
 SELECT member."id",member."role",member."isActive"
 INTO recipient FROM "Membership" member
 JOIN "User" user_account ON user_account."id"=member."userId"
   AND user_account."emailVerified"=true
 WHERE member."schoolId"=p_school
   AND member."id"=p_recipient_member
   AND member."isActive"=true
   AND member."role" IN ('STUDENT','PARENT');
 IF NOT FOUND THEN
   RETURN 'NO_VERIFIED_RELATIONSHIP_OR_POLICY';
 END IF;
 IF recipient."role"='STUDENT'
   AND visibility IN ('STUDENT_AFTER_RELEASE','GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   AND EXISTS (
     SELECT 1 FROM "StudentAccountLink" link
     LEFT JOIN "StudentAccountLinkRevocation" revoked
       ON revoked."schoolId"=link."schoolId" AND revoked."linkId"=link."id"
     WHERE link."schoolId"=p_school
       AND link."studentId"=p_student
       AND link."studentMembershipId"=p_recipient_member
       AND revoked."id" IS NULL
   ) THEN
   RETURN 'RELATIONSHIP_VERIFIED_NOT_RELEASED';
 END IF;
 IF recipient."role"='PARENT'
   AND visibility IN ('GUARDIAN_AFTER_RELEASE','GUARDIAN_AND_STUDENT_AFTER_RELEASE')
   AND (
     SELECT evt."action" FROM "GuardianStudentRelationshipEvent" evt
     WHERE evt."schoolId"=p_school
       AND evt."studentId"=p_student
       AND evt."guardianMembershipId"=p_recipient_member
     ORDER BY evt."ordinal" DESC LIMIT 1
   )='VERIFY' THEN
   RETURN 'RELATIONSHIP_VERIFIED_NOT_RELEASED';
 END IF;
 RETURN 'NO_VERIFIED_RELATIONSHIP_OR_POLICY';
END;
$$ LANGUAGE plpgsql STABLE;

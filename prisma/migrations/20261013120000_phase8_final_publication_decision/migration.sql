-- Phase 8: immutable independent School Super Admin final approval evidence.
-- This is an AUDITED APPROVAL AWAITING RELEASE, not a student-visible report,
-- published grade, visibility rule, export or result distribution.
CREATE TABLE "ResultFinalPublicationDecision" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "evidenceId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
 "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "adoptionId" TEXT NOT NULL, "evidenceRevision" INTEGER NOT NULL,
 "ordinal" INTEGER NOT NULL DEFAULT 1,
 "status" VARCHAR(40) NOT NULL DEFAULT 'APPROVED_AWAITING_RELEASE',
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultFinalPublicationDecision_pkey" PRIMARY KEY("id"),
 CONSTRAINT "ResultFinalPublicationDecision_integrity_check" CHECK (
   "evidenceRevision">=1 AND "ordinal">=1
   AND "status"='APPROVED_AWAITING_RELEASE'
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ResultFinalPublicationDecision_schoolId_id_key"
 ON "ResultFinalPublicationDecision"("schoolId","id");
CREATE UNIQUE INDEX "ResultFinalPublicationDecision_schoolId_evidenceId_key"
 ON "ResultFinalPublicationDecision"("schoolId","evidenceId");
CREATE UNIQUE INDEX "ResultFinalPublicationDecision_context_ordinal_key"
 ON "ResultFinalPublicationDecision"("schoolId","sessionId","termId",
   "classId","subjectId","ordinal");
CREATE INDEX "ResultFinalPublicationDecision_schoolId_decidedAt_idx"
 ON "ResultFinalPublicationDecision"("schoolId","decidedAt");
ALTER TABLE "ResultFinalPublicationDecision"
 ADD CONSTRAINT "ResultFinalPublicationDecision_schoolId_fkey"
 FOREIGN KEY("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultFinalPublicationDecision"
 ADD CONSTRAINT "ResultFinalPublicationDecision_evidence_fkey"
 FOREIGN KEY("schoolId","evidenceId")
 REFERENCES "ResultSheetEvidence"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultFinalPublicationDecision"
 ADD CONSTRAINT "ResultFinalPublicationDecision_adoption_fkey"
 FOREIGN KEY("schoolId","adoptionId")
 REFERENCES "ResultGradingAdoption"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultFinalPublicationDecision"
 ADD CONSTRAINT "ResultFinalPublicationDecision_actor_fkey"
 FOREIGN KEY("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_final_result_publication_decision"()
 RETURNS trigger AS $$
DECLARE
 snapshot RECORD;
 next_ordinal INT;
BEGIN
 -- The predicate acquires a School row FOR UPDATE lock and revalidates
 -- the CURRENT active owner, teacher, class, section reviewer grant,
 -- latest result evidence, latest adopted grading policy and per-pupil
 -- complete unchanged sourceManifest BEFORE this append-only final decision.
 PERFORM "assert_result_publication_readiness"(
   NEW."schoolId", NEW."evidenceId",
   NEW."actorMembershipId", NEW."actorUserId");

 SELECT e."sessionId",e."termId",e."classId",e."subjectId",
   e."adoptionId",e."revision" INTO snapshot
 FROM "ResultSheetEvidence" e
 WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."evidenceId";
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Validated result evidence not found' USING ERRCODE='23503';
 END IF;
 IF EXISTS (
  SELECT 1 FROM "ResultFinalPublicationDecision" prior
  WHERE prior."schoolId"=NEW."schoolId"
    AND prior."evidenceId"=NEW."evidenceId"
 ) THEN
  RAISE EXCEPTION 'Final owner decision already exists for this evidence'
    USING ERRCODE='23505';
 END IF;
 SELECT COALESCE(MAX(prior."ordinal"),0)::int+1 INTO next_ordinal
 FROM "ResultFinalPublicationDecision" prior
 WHERE prior."schoolId"=NEW."schoolId"
   AND prior."sessionId"=snapshot."sessionId"
   AND prior."termId"=snapshot."termId"
   AND prior."classId"=snapshot."classId"
   AND prior."subjectId"=snapshot."subjectId";

 -- All contextual identifiers, revision, status, ordering and audit
 -- timestamp come from trusted database evidence; browser fields are ignored.
 NEW."sessionId":=snapshot."sessionId";
 NEW."termId":=snapshot."termId";
 NEW."classId":=snapshot."classId";
 NEW."subjectId":=snapshot."subjectId";
 NEW."adoptionId":=snapshot."adoptionId";
 NEW."evidenceRevision":=snapshot."revision";
 NEW."ordinal":=next_ordinal;
 NEW."status":='APPROVED_AWAITING_RELEASE';
 NEW."decidedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ResultFinalPublicationDecision_validate"
 BEFORE INSERT ON "ResultFinalPublicationDecision"
 FOR EACH ROW EXECUTE FUNCTION "validate_final_result_publication_decision"();
CREATE TRIGGER "ResultFinalPublicationDecision_immutable"
 BEFORE UPDATE OR DELETE ON "ResultFinalPublicationDecision"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultFinalPublicationDecision_no_truncate"
 BEFORE TRUNCATE ON "ResultFinalPublicationDecision"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

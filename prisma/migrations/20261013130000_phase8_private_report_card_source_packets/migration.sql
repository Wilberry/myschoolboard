-- Phase 8: frozen PRIVATE per-pupil source packets after independent
-- academic review AND the immutable final School Super Admin decision.
-- This is NOT an official report card, grade scale, publish/release event,
-- transcript, download or student/guardian visibility.
CREATE TABLE "ResultReportCardSourcePacket" (
 "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
 "finalDecisionId" TEXT NOT NULL, "evidenceId" TEXT NOT NULL,
 "adoptionId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
 "termId" TEXT NOT NULL, "classId" TEXT NOT NULL,
 "subjectId" TEXT NOT NULL,
 "evidenceRevision" INTEGER NOT NULL DEFAULT 1,
 "finalDecisionOrdinal" INTEGER NOT NULL DEFAULT 1,
 "studentCount" INTEGER NOT NULL DEFAULT 0,
 "studentSourceCards" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "reason" VARCHAR(500) NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ResultReportCardSourcePacket_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ResultReportCardSourcePacket_content_check" CHECK (
   "evidenceRevision">=1 AND "finalDecisionOrdinal">=1
   AND "studentCount" BETWEEN 1 AND 500
   AND jsonb_typeof("studentSourceCards")='array'
   AND jsonb_array_length("studentSourceCards")="studentCount"
   AND char_length(btrim("reason")) BETWEEN 5 AND 500)
);
CREATE UNIQUE INDEX "ResultReportCardSourcePacket_schoolId_id_key"
 ON "ResultReportCardSourcePacket"("schoolId","id");
CREATE UNIQUE INDEX "ResultReportCardSourcePacket_schoolId_finalDecisionId_key"
 ON "ResultReportCardSourcePacket"("schoolId","finalDecisionId");
CREATE INDEX "ResultReportCardSourcePacket_schoolId_preparedAt_idx"
 ON "ResultReportCardSourcePacket"("schoolId","preparedAt");
ALTER TABLE "ResultReportCardSourcePacket"
 ADD CONSTRAINT "ResultReportCardSourcePacket_schoolId_fkey"
 FOREIGN KEY("schoolId") REFERENCES "School"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultReportCardSourcePacket"
 ADD CONSTRAINT "ResultReportCardSourcePacket_finalDecision_fkey"
 FOREIGN KEY("schoolId","finalDecisionId")
 REFERENCES "ResultFinalPublicationDecision"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultReportCardSourcePacket"
 ADD CONSTRAINT "ResultReportCardSourcePacket_evidence_fkey"
 FOREIGN KEY("schoolId","evidenceId")
 REFERENCES "ResultSheetEvidence"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultReportCardSourcePacket"
 ADD CONSTRAINT "ResultReportCardSourcePacket_adoption_fkey"
 FOREIGN KEY("schoolId","adoptionId")
 REFERENCES "ResultGradingAdoption"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ResultReportCardSourcePacket"
 ADD CONSTRAINT "ResultReportCardSourcePacket_actor_fkey"
 FOREIGN KEY("schoolId","actorMembershipId")
 REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_report_card_source_packet"() RETURNS trigger AS $$
DECLARE
 snapshot RECORD;
 adopted_policy RECORD;
 cards JSONB;
BEGIN
 -- Re-check under the same active school row lock as all prior Phase 8
 -- adoption/evidence/review/owner-approval events. The caller cannot
 -- manufacture a student, grading policy, mark or official result.
 SELECT decision."evidenceId", decision."adoptionId",
  decision."sessionId", decision."termId", decision."classId",
  decision."subjectId", decision."evidenceRevision",
  decision."ordinal", decision."status",
  evidence."sourceManifest", evidence."studentCount"
 INTO snapshot
 FROM "ResultFinalPublicationDecision" decision
 JOIN "ResultSheetEvidence" evidence
   ON evidence."schoolId"=decision."schoolId"
   AND evidence."id"=decision."evidenceId"
 WHERE decision."schoolId"=NEW."schoolId"
   AND decision."id"=NEW."finalDecisionId";
 IF snapshot."evidenceId" IS NULL
   OR snapshot."status"<>'APPROVED_AWAITING_RELEASE' THEN
   RAISE EXCEPTION 'Exact internal final owner approval required'
    USING ERRCODE='23503';
 END IF;
 PERFORM "assert_result_publication_readiness"(
   NEW."schoolId",snapshot."evidenceId",
   NEW."actorMembershipId",NEW."actorUserId");
 IF EXISTS (
   SELECT 1 FROM "ResultReportCardSourcePacket" existing
   WHERE existing."schoolId"=NEW."schoolId"
     AND existing."finalDecisionId"=NEW."finalDecisionId"
 ) THEN
   RAISE EXCEPTION 'Frozen source packet already prepared for this decision'
    USING ERRCODE='23505';
 END IF;
 SELECT grade."version",grade."quizWeight",grade."testWeight",
   grade."examWeight" INTO adopted_policy
 FROM "ResultGradingAdoption" adoption
 JOIN "AssessmentGradingPolicyRevision" grade
   ON grade."schoolId"=adoption."schoolId"
   AND grade."id"=adoption."policyId"
 WHERE adoption."schoolId"=NEW."schoolId"
   AND adoption."id"=snapshot."adoptionId";
 IF adopted_policy."version" IS NULL THEN
   RAISE EXCEPTION 'Exact adopted grade weights required'
    USING ERRCODE='23503';
 END IF;
 -- Allowlist the frozen student identities and numeric source keys.
 -- No answer options, correctness keys, draft questions, percentages,
 -- invented grade bands, pass/fail, parent link or visibility are frozen.
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'studentId',pupil.value->>'studentId',
   'admissionNumber',pupil.value->>'admissionNumber',
   'givenName',pupil.value->>'givenName',
   'familyName',pupil.value->>'familyName',
   'cbt',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
       'draftId',item.value->'draftId',
       'kind',item.value->'kind',
       'attemptId',item.value->'attemptId',
       'earnedPoints',item.value->'earnedPoints',
       'maxPoints',item.value->'maxPoints'
     ) ORDER BY item.value->>'draftId')
     FROM jsonb_array_elements(pupil.value->'cbt') AS item(value)
   ),'[]'::jsonb),
   'manual',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
       'componentId',item.value->'componentId',
       'kind',item.value->'kind',
       'markId',item.value->'markId',
       'originalPoints',item.value->'originalPoints',
       'effectivePoints',item.value->'effectivePoints',
       'maxPoints',item.value->'maxPoints',
       'approvedCorrectionRevision',item.value->'approvedCorrectionRevision'
     ) ORDER BY item.value->>'componentId')
     FROM jsonb_array_elements(pupil.value->'manual') AS item(value)
   ),'[]'::jsonb),
   'adoptedWeightVersion',adopted_policy."version",
   'quizWeight',adopted_policy."quizWeight",
   'testWeight',adopted_policy."testWeight",
   'examWeight',adopted_policy."examWeight",
   'reportStatus','INTERNAL_SOURCE_ONLY_NOT_RELEASED'
 ) ORDER BY pupil.value->>'studentId'),'[]'::jsonb) INTO cards
 FROM jsonb_array_elements(snapshot."sourceManifest") AS pupil(value);
 IF jsonb_array_length(cards)<>snapshot."studentCount" THEN
   RAISE EXCEPTION 'Frozen enrolled pupil count changed'
    USING ERRCODE='23514';
 END IF;
 NEW."evidenceId":=snapshot."evidenceId";
 NEW."adoptionId":=snapshot."adoptionId";
 NEW."sessionId":=snapshot."sessionId";
 NEW."termId":=snapshot."termId";
 NEW."classId":=snapshot."classId";
 NEW."subjectId":=snapshot."subjectId";
 NEW."evidenceRevision":=snapshot."evidenceRevision";
 NEW."finalDecisionOrdinal":=snapshot."ordinal";
 NEW."studentCount":=jsonb_array_length(cards);
 NEW."studentSourceCards":=cards;
 NEW."preparedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ResultReportCardSourcePacket_validate"
 BEFORE INSERT ON "ResultReportCardSourcePacket"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_card_source_packet"();
CREATE TRIGGER "ResultReportCardSourcePacket_immutable"
 BEFORE UPDATE OR DELETE ON "ResultReportCardSourcePacket"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ResultReportCardSourcePacket_no_truncate"
 BEFORE TRUNCATE ON "ResultReportCardSourcePacket"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

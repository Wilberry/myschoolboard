-- Minimal, transactional source envelopes. No historical rows are backfilled.
-- Existing notice/class outboxes and source ledgers remain intact.
CREATE TABLE "SchoolSourceEvent" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"schoolId" TEXT NOT NULL,"sourceType" VARCHAR(64) NOT NULL,"sourceId" TEXT NOT NULL,"schemaVersion" INTEGER NOT NULL DEFAULT 1 CHECK("schemaVersion"=1),"action" VARCHAR(64) NOT NULL,"actorUserId" TEXT,"occurredAt" TIMESTAMPTZ NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","sourceType","sourceId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE INDEX "SchoolSourceEvent_school_time" ON "SchoolSourceEvent"("schoolId","createdAt" DESC,"id");
CREATE TABLE "SchoolSourceOutbox" (
 "schoolId" TEXT NOT NULL,"eventId" UUID PRIMARY KEY,"state" TEXT NOT NULL DEFAULT 'PENDING' CHECK("state" IN ('PENDING','RETRY_WAIT','DONE','DEAD_LETTER')),"failures" INTEGER NOT NULL DEFAULT 0 CHECK("failures" BETWEEN 0 AND 5),"cursorMembershipId" TEXT,"nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","eventId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,FOREIGN KEY("schoolId","eventId") REFERENCES "SchoolSourceEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "SchoolSourceOutbox_due" ON "SchoolSourceOutbox"("schoolId","state","nextAttemptAt","eventId");
CREATE FUNCTION phase10_source_envelope_insert() RETURNS trigger AS $$
BEGIN
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Source envelopes require transactional capture' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp(); RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SchoolSourceEvent_capture_only" BEFORE INSERT ON "SchoolSourceEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_envelope_insert();
CREATE FUNCTION phase10_source_capture() RETURNS trigger AS $$
DECLARE captured UUID; source_time TIMESTAMPTZ; source_actor TEXT; source_action TEXT; snapshot JSONB;
BEGIN
 snapshot:=to_jsonb(NEW);
 CASE TG_TABLE_NAME
 WHEN 'TeacherClassSubjectAssignmentEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'SchoolLifecycleEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'SchoolConfigurationEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'FormTeacherEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'TimetableEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'LessonNoteEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'LessonReleaseEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'StudentEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'AttendanceEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'eventType';
 WHEN 'AssessmentReviewEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'reviewerUserId';source_action:='RECORDED';
 WHEN 'AssessmentPublicationEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'ResultSheetReview' THEN source_time:=(snapshot->>'reviewedAt')::timestamptz;source_actor:=snapshot->>'reviewerUserId';source_action:=snapshot->>'action';
 WHEN 'ResultFinalPublicationDecision' THEN source_time:=(snapshot->>'decidedAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'status';
 WHEN 'ReportPublication' THEN source_time:=(snapshot->>'publishedAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'ReportPublicationWithdrawal' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'ReportGuardianAcknowledgment' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'PaymentVerificationDecision' THEN source_time:=(snapshot->>'decidedAt')::timestamptz;source_actor:=snapshot->>'reviewerUserId';source_action:=snapshot->>'action';
 WHEN 'FeeAccountRelease' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'FeeReceipt' THEN source_time:=(snapshot->>'issuedAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'NoticeWorkflowEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'NoticeRelease' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'NoticeWithdrawal' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'ClassAnnouncementEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'LibraryCatalogReview' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'LibraryCatalogRelease' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LibraryCatalogWithdrawal' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LearningAssetInspection' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=NULL;source_action:=snapshot->>'verdict';
 WHEN 'LearningAssetRights' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LearningAssetRelease' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LearningAssetWithdrawal' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LearningAssignmentPolicy' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 WHEN 'LearningAssignmentEvent' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'LearningSubmissionReview' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'action';
 WHEN 'PaymentEvidence' THEN source_time:=(snapshot->>'submittedAt')::timestamptz;source_actor:=snapshot->>'submitterUserId';source_action:=snapshot->>'status';
 WHEN 'ResultSheetEvidence' THEN source_time:=(snapshot->>'preparedAt')::timestamptz;source_actor:=snapshot->>'teacherUserId';source_action:='RECORDED';
 WHEN 'LearningSubmissionRevision' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:='RECORDED';
 ELSE RAISE EXCEPTION 'Unregistered school source' USING ERRCODE='23503';
 END CASE;
 INSERT INTO "SchoolSourceEvent"("schoolId","sourceType","sourceId","action","actorUserId","occurredAt") VALUES(snapshot->>'schoolId',TG_TABLE_NAME,snapshot->>'id',source_action,source_actor,source_time) RETURNING "id" INTO captured;
 INSERT INTO "SchoolSourceOutbox"("schoolId","eventId") VALUES(snapshot->>'schoolId',captured);
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TeacherClassSubjectAssignmentEvent_source_capture" AFTER INSERT ON "TeacherClassSubjectAssignmentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "SchoolLifecycleEvent_source_capture" AFTER INSERT ON "SchoolLifecycleEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "SchoolConfigurationEvent_source_capture" AFTER INSERT ON "SchoolConfigurationEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "FormTeacherEvent_source_capture" AFTER INSERT ON "FormTeacherEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "TimetableEvent_source_capture" AFTER INSERT ON "TimetableEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LessonNoteEvent_source_capture" AFTER INSERT ON "LessonNoteEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LessonReleaseEvent_source_capture" AFTER INSERT ON "LessonReleaseEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "StudentEvent_source_capture" AFTER INSERT ON "StudentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "AttendanceEvent_source_capture" AFTER INSERT ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "AssessmentReviewEvent_source_capture" AFTER INSERT ON "AssessmentReviewEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "AssessmentPublicationEvent_source_capture" AFTER INSERT ON "AssessmentPublicationEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ResultSheetReview_source_capture" AFTER INSERT ON "ResultSheetReview" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ResultFinalPublicationDecision_source_capture" AFTER INSERT ON "ResultFinalPublicationDecision" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ReportPublication_source_capture" AFTER INSERT ON "ReportPublication" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ReportPublicationWithdrawal_source_capture" AFTER INSERT ON "ReportPublicationWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ReportGuardianAcknowledgment_source_capture" AFTER INSERT ON "ReportGuardianAcknowledgment" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "PaymentVerificationDecision_source_capture" AFTER INSERT ON "PaymentVerificationDecision" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "FeeAccountRelease_source_capture" AFTER INSERT ON "FeeAccountRelease" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "FeeReceipt_source_capture" AFTER INSERT ON "FeeReceipt" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "NoticeWorkflowEvent_source_capture" AFTER INSERT ON "NoticeWorkflowEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "NoticeRelease_source_capture" AFTER INSERT ON "NoticeRelease" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "NoticeWithdrawal_source_capture" AFTER INSERT ON "NoticeWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ClassAnnouncementEvent_source_capture" AFTER INSERT ON "ClassAnnouncementEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LibraryCatalogReview_source_capture" AFTER INSERT ON "LibraryCatalogReview" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LibraryCatalogRelease_source_capture" AFTER INSERT ON "LibraryCatalogRelease" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LibraryCatalogWithdrawal_source_capture" AFTER INSERT ON "LibraryCatalogWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssetInspection_source_capture" AFTER INSERT ON "LearningAssetInspection" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssetRights_source_capture" AFTER INSERT ON "LearningAssetRights" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssetRelease_source_capture" AFTER INSERT ON "LearningAssetRelease" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssetWithdrawal_source_capture" AFTER INSERT ON "LearningAssetWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssignmentPolicy_source_capture" AFTER INSERT ON "LearningAssignmentPolicy" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningAssignmentEvent_source_capture" AFTER INSERT ON "LearningAssignmentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningSubmissionReview_source_capture" AFTER INSERT ON "LearningSubmissionReview" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "PaymentEvidence_source_capture" AFTER INSERT ON "PaymentEvidence" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "ResultSheetEvidence_source_capture" AFTER INSERT ON "ResultSheetEvidence" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "LearningSubmissionRevision_source_capture" AFTER INSERT ON "LearningSubmissionRevision" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "SchoolSourceEvent_immutable" BEFORE UPDATE OR DELETE ON "SchoolSourceEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "SchoolSourceEvent_no_truncate" BEFORE TRUNCATE ON "SchoolSourceEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

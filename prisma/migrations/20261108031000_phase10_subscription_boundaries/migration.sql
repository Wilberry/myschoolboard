-- Observes persisted subscription boundaries without changing entitlements.
CREATE TABLE "SubscriptionBoundaryEvent" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"schoolId" TEXT NOT NULL,
 "periodId" TEXT NOT NULL,"kind" TEXT NOT NULL CHECK("kind"='SUBSCRIPTION_ENDED'),
 "boundaryAt" TIMESTAMPTZ NOT NULL,"actorUserId" TEXT NOT NULL,
 "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "SubscriptionBoundaryEvent_schoolId_fkey" FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 CONSTRAINT "SubscriptionBoundaryEvent_period_fkey" FOREIGN KEY("schoolId","periodId") REFERENCES "SchoolSubscriptionPeriod"("schoolId","id") ON DELETE NO ACTION,
 UNIQUE("schoolId","id"),UNIQUE("schoolId","periodId","kind")
);
CREATE INDEX "SchoolSubscriptionPeriod_endsAt_schoolId_id_idx" ON "SchoolSubscriptionPeriod"("endsAt","schoolId","id");
CREATE FUNCTION phase10_boundary_validate() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE "id"=NEW."actorUserId" AND "platformRole"='SUPER_ADMIN' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable operator' USING ERRCODE='23503';END IF;
 PERFORM 1 FROM "SchoolSubscriptionPeriod" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."periodId" AND "endsAt"=NEW."boundaryAt" AND "endsAt"<=clock_timestamp() FOR SHARE;
 IF NOT FOUND OR NEW."kind"<>'SUBSCRIPTION_ENDED' THEN RAISE EXCEPTION 'Unavailable boundary' USING ERRCODE='23503';END IF;
 NEW."occurredAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SubscriptionBoundaryEvent_validate" BEFORE INSERT ON "SubscriptionBoundaryEvent" FOR EACH ROW EXECUTE FUNCTION phase10_boundary_validate();
CREATE TRIGGER "SubscriptionBoundaryEvent_immutable" BEFORE UPDATE OR DELETE ON "SubscriptionBoundaryEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "SubscriptionBoundaryEvent_no_truncate" BEFORE TRUNCATE ON "SubscriptionBoundaryEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE OR REPLACE FUNCTION phase10_source_capture() RETURNS trigger AS $$
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
 WHEN 'AttendanceCorrectionRequest' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'requestedByUserId';source_action:='REQUESTED';
 WHEN 'AttendanceCorrectionDecision' THEN source_time:=(snapshot->>'createdAt')::timestamptz;source_actor:=snapshot->>'reviewerUserId';source_action:=CASE WHEN (snapshot->>'approved')::boolean THEN 'APPROVED' ELSE 'RETURNED' END;
 WHEN 'SubscriptionBoundaryEvent' THEN source_time:=(snapshot->>'occurredAt')::timestamptz;source_actor:=snapshot->>'actorUserId';source_action:=snapshot->>'kind';
 ELSE RAISE EXCEPTION 'Unregistered school source' USING ERRCODE='23503';
 END CASE;
 INSERT INTO "SchoolSourceEvent"("schoolId","sourceType","sourceId","action","actorUserId","occurredAt") VALUES(snapshot->>'schoolId',TG_TABLE_NAME,snapshot->>'id',source_action,source_actor,source_time) RETURNING "id" INTO captured;
 INSERT INTO "SchoolSourceOutbox"("schoolId","eventId") VALUES(snapshot->>'schoolId',captured);
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SubscriptionBoundaryEvent_source_capture" AFTER INSERT ON "SubscriptionBoundaryEvent" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();

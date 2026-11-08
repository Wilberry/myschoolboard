-- Source-owned academic notification predicates; no pupil names or marks copied.
CREATE FUNCTION phase10_family_learning_notification(s TEXT,event UUID,u TEXT) RETURNS BOOLEAN AS $$
DECLARE source "SchoolSourceEvent"%ROWTYPE;
BEGIN
 IF phase10_learning_resource_notification(s,event,u) THEN RETURN true;END IF;
 SELECT * INTO source FROM "SchoolSourceEvent" WHERE "schoolId"=s AND "id"=event;
 IF source."id" IS NULL THEN RETURN false;END IF;
 IF source."sourceType"='ReportPublication' THEN
 RETURN EXISTS(SELECT 1 FROM "ReportPublication" publication JOIN "PrivateOfficialReportComposition" c ON c."schoolId"=publication."schoolId" AND c."id"=publication."compositionId" JOIN "ResultReportCardSourcePacket" packet ON packet."schoolId"=c."schoolId" AND packet."id"=c."sourcePacketId" JOIN "Membership" m ON m."schoolId"=publication."schoolId" AND m."userId"=u AND m."isActive" WHERE publication."schoolId"=s AND publication."id"=source."sourceId" AND phase10_current_report(s,publication."id") AND (m."role"<>'STUDENT' OR publication."visibility"<>'PARENT_FIRST') AND EXISTS(SELECT 1 FROM (SELECT b."studentId" FROM "StudentAccountLink" b WHERE b."schoolId"=s AND b."studentMembershipId"=m."id" UNION SELECT b."studentId" FROM "GuardianStudentLink" b WHERE b."schoolId"=s AND b."guardianMembershipId"=m."id") child WHERE can_read_published_report(s,publication."id",child."studentId",u) AND EXISTS(SELECT 1 FROM jsonb_array_elements(packet."studentSourceCards") identity WHERE identity->>'studentId'=child."studentId")));
 ELSIF source."sourceType"='ReportGuardianAcknowledgment' THEN
 RETURN EXISTS(SELECT 1 FROM "ReportGuardianAcknowledgment" ack JOIN "ReportPublication" publication ON publication."schoolId"=ack."schoolId" AND publication."id"=ack."publicationId" WHERE ack."schoolId"=s AND ack."id"=source."sourceId" AND phase10_current_report(s,publication."id") AND (phase10_owner(s,u) OR (publication."visibility"='PARENT_FIRST' AND EXISTS(SELECT 1 FROM "Membership" m JOIN "StudentAccountLink" binding ON binding."schoolId"=m."schoolId" AND binding."studentMembershipId"=m."id" AND binding."studentId"=ack."studentId" WHERE m."schoolId"=s AND m."userId"=u AND m."role"='STUDENT' AND m."isActive" AND can_read_published_report(s,publication."id",ack."studentId",u)) AND EXISTS(SELECT 1 FROM "GuardianStudentLink" link JOIN "Membership" guardian ON guardian."schoolId"=link."schoolId" AND guardian."id"=link."guardianMembershipId" AND guardian."role"='PARENT' AND guardian."isActive" WHERE link."schoolId"=s AND link."id"=ack."guardianLinkId" AND link."studentId"=ack."studentId" AND NOT EXISTS(SELECT 1 FROM "GuardianStudentLinkRevocation" revoked WHERE revoked."schoolId"=s AND revoked."linkId"=link."id")))));
 ELSIF source."sourceType"='FeeAccountRelease' THEN
 RETURN EXISTS(SELECT 1 FROM "FeeAccountRelease" release WHERE release."schoolId"=s AND release."id"=source."sourceId" AND release."action"='PUBLISHED' AND can_read_fee_account(s,release."obligationId",u) AND NOT EXISTS(SELECT 1 FROM "FeeAccountRelease" newer WHERE newer."schoolId"=s AND newer."obligationId"=release."obligationId" AND newer."revision">release."revision"));
 ELSIF source."sourceType"='FeeReceipt' THEN
 RETURN EXISTS(SELECT 1 FROM "FeeReceipt" receipt WHERE receipt."schoolId"=s AND receipt."id"=source."sourceId" AND can_read_fee_account(s,receipt."obligationId",u));
 ELSIF source."sourceType"='PaymentEvidence' THEN
 RETURN EXISTS(SELECT 1 FROM "PaymentEvidence" evidence JOIN "Membership" author ON author."schoolId"=evidence."schoolId" AND author."id"=evidence."submitterMembershipId" AND author."userId"=evidence."submitterUserId" AND author."isActive" AND author."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN') WHERE evidence."schoolId"=s AND evidence."id"=source."sourceId" AND evidence."submitterUserId"<>u AND phase10_owner(s,u) AND NOT EXISTS(SELECT 1 FROM "PaymentVerificationDecision" decision WHERE decision."schoolId"=s AND decision."evidenceId"=evidence."id"));
 ELSIF source."sourceType"='PaymentVerificationDecision' THEN
 RETURN EXISTS(SELECT 1 FROM "PaymentVerificationDecision" decision JOIN "PaymentEvidence" evidence ON evidence."schoolId"=decision."schoolId" AND evidence."id"=decision."evidenceId" JOIN "Membership" author ON author."schoolId"=evidence."schoolId" AND author."id"=evidence."submitterMembershipId" AND author."userId"=u AND author."userId"=evidence."submitterUserId" AND author."isActive" AND author."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN') JOIN "School" school ON school."id"=author."schoolId" AND school."isActive" WHERE decision."schoolId"=s AND decision."id"=source."sourceId");
 END IF;
 RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;
CREATE FUNCTION phase10_notification_section(s TEXT,c TEXT,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" school JOIN "SchoolClass" room ON room."schoolId"=school."id" AND room."id"=c AND room."isActive" JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=room."sectionId" AND section."isActive" JOIN "Membership" m ON m."schoolId"=school."id" AND m."userId"=u AND m."isActive" JOIN "ScopeGrant" g ON g."membershipId"=m."id" AND g."type"='SECTION' AND g."verified" AND g."scopeId"=section."id" WHERE school."id"=s AND school."isActive" AND ((m."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY') OR (m."role"='PRINCIPAL' AND section."stage"='SECONDARY')));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_notification_subject(s TEXT,c TEXT,period TEXT,term_id TEXT,subject_id TEXT,assignment_id TEXT,teacher_id TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" school JOIN "SchoolClass" room ON room."schoolId"=school."id" AND room."id"=c AND room."isActive" JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=room."sectionId" AND section."isActive" JOIN "AcademicSession" session ON session."schoolId"=school."id" AND session."id"=period AND session."status"='ACTIVE' JOIN "AcademicTerm" term ON term."schoolId"=school."id" AND term."id"=term_id AND term."sessionId"=session."id" AND term."status"='ACTIVE' JOIN "Subject" subject ON subject."schoolId"=school."id" AND subject."id"=subject_id AND subject."isActive" JOIN "Membership" teacher ON teacher."schoolId"=school."id" AND teacher."id"=teacher_id AND teacher."role"='TEACHER' AND teacher."isActive" JOIN "TeacherClassSubjectAssignment" assignment ON assignment."schoolId"=school."id" AND assignment."id"=assignment_id AND assignment."membershipId"=teacher."id" AND assignment."classId"=room."id" AND assignment."subjectId"=subject."id" AND assignment."sessionId"=session."id" AND assignment."status"='ACTIVE' WHERE school."id"=s AND school."isActive");
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_notification_form(s TEXT,c TEXT,period TEXT,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" school JOIN "SchoolClass" room ON room."schoolId"=school."id" AND room."id"=c AND room."isActive" JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=room."sectionId" AND section."isActive" JOIN "AcademicSession" session ON session."schoolId"=school."id" AND session."id"=period AND session."status"='ACTIVE' JOIN "Membership" m ON m."schoolId"=school."id" AND m."userId"=u AND m."role" IN ('TEACHER','FORM_TEACHER') AND m."isActive" JOIN "FormTeacherResponsibility" f ON f."schoolId"=school."id" AND f."membershipId"=m."id" AND f."classId"=room."id" AND f."sessionId"=session."id" AND f."kind"='PRIMARY' AND f."status"='ACTIVE' WHERE school."id"=s AND school."isActive");
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_notification_pupil(s TEXT,c TEXT,period TEXT,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" school JOIN "SchoolClass" room ON room."schoolId"=school."id" AND room."id"=c AND room."isActive" JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=room."sectionId" AND section."isActive" JOIN "AcademicSession" session ON session."schoolId"=school."id" AND session."id"=period AND session."status"='ACTIVE' JOIN "Membership" m ON m."schoolId"=school."id" AND m."userId"=u AND m."role"='STUDENT' AND m."isActive" JOIN "StudentAccountLink" binding ON binding."schoolId"=school."id" AND binding."studentMembershipId"=m."id" JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id" AND pupil."id"=binding."studentId" AND pupil."status"='ENROLLED' JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=school."id" AND enrollment."studentId"=pupil."id" AND enrollment."classId"=room."id" AND enrollment."sessionId"=session."id" AND enrollment."status"='ACTIVE' WHERE school."id"=s AND school."isActive" AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" revoked WHERE revoked."schoolId"=s AND revoked."linkId"=binding."id"));
$$ LANGUAGE sql STABLE;
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
 ELSE RAISE EXCEPTION 'Unregistered school source' USING ERRCODE='23503';
 END CASE;
 INSERT INTO "SchoolSourceEvent"("schoolId","sourceType","sourceId","action","actorUserId","occurredAt") VALUES(snapshot->>'schoolId',TG_TABLE_NAME,snapshot->>'id',source_action,source_actor,source_time) RETURNING "id" INTO captured;
 INSERT INTO "SchoolSourceOutbox"("schoolId","eventId") VALUES(snapshot->>'schoolId',captured);
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION can_read_module_notification(s TEXT,event UUID,u TEXT) RETURNS BOOLEAN AS $$
DECLARE source "SchoolSourceEvent"%ROWTYPE;
BEGIN
 SELECT * INTO source FROM "SchoolSourceEvent" WHERE "schoolId"=s AND "id"=event;
 IF source."id" IS NULL THEN RETURN false;END IF;
 IF source."sourceType"='AttendanceEvent' THEN
 RETURN EXISTS(SELECT 1 FROM "AttendanceEvent" e JOIN "AttendanceRegister" r ON r."schoolId"=e."schoolId" AND r."id"=e."registerId" JOIN "AcademicSession" session ON session."schoolId"=r."schoolId" AND session."id"=r."sessionId" AND session."status"='ACTIVE' WHERE e."schoolId"=s AND e."id"=source."sourceId" AND ((e."eventType"='SUBMITTED' AND r."status"='SUBMITTED' AND phase10_notification_section(s,r."classId",u)) OR (e."eventType" IN ('APPROVED','RETURNED') AND r."status"::text=e."eventType"::text AND phase10_notification_form(s,r."classId",r."sessionId",u) AND EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=s AND m."id"=r."submittedByMembershipId" AND m."userId"=u))));
 ELSIF source."sourceType"='AttendanceCorrectionRequest' THEN
 RETURN EXISTS(SELECT 1 FROM "AttendanceCorrectionRequest" request JOIN "AttendanceRegister" r ON r."schoolId"=request."schoolId" AND r."id"=request."registerId" AND r."status"='APPROVED' JOIN "AcademicSession" session ON session."schoolId"=r."schoolId" AND session."id"=r."sessionId" AND session."status"='ACTIVE' WHERE request."schoolId"=s AND request."id"=source."sourceId" AND phase10_notification_section(s,r."classId",u) AND NOT EXISTS(SELECT 1 FROM "AttendanceCorrectionDecision" decision WHERE decision."schoolId"=s AND decision."requestId"=request."id"));
 ELSIF source."sourceType"='AttendanceCorrectionDecision' THEN
 RETURN EXISTS(SELECT 1 FROM "AttendanceCorrectionDecision" decision JOIN "AttendanceCorrectionRequest" request ON request."schoolId"=decision."schoolId" AND request."id"=decision."requestId" JOIN "AttendanceRegister" r ON r."schoolId"=request."schoolId" AND r."id"=request."registerId" AND r."status"='APPROVED' JOIN "Membership" m ON m."schoolId"=s AND m."id"=request."requestedByMembershipId" AND m."userId"=request."requestedByUserId" AND m."userId"=u WHERE decision."schoolId"=s AND decision."id"=source."sourceId" AND phase10_notification_form(s,r."classId",r."sessionId",u));
 ELSIF source."sourceType"='LessonNoteEvent' THEN
 RETURN EXISTS(SELECT 1 FROM "LessonNoteEvent" e JOIN "LessonNote" n ON n."schoolId"=e."schoolId" AND n."id"=e."noteId" AND n."currentRevision"=e."revisionNumber" WHERE e."schoolId"=s AND e."id"=source."sourceId" AND phase10_notification_subject(s,n."classId",n."sessionId",n."termId",n."subjectId",n."assignmentId",n."teacherMembershipId") AND ((e."eventType"='SUBMITTED' AND n."status"='SUBMITTED' AND phase10_notification_section(s,n."classId",u)) OR (e."eventType" IN ('APPROVED','RETURNED') AND n."status"::text=e."eventType"::text AND EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=s AND m."id"=n."teacherMembershipId" AND m."userId"=u))));
 ELSIF source."sourceType"='LessonReleaseEvent' THEN
 RETURN EXISTS(SELECT 1 FROM "LessonReleaseEvent" e JOIN "LessonNote" n ON n."schoolId"=e."schoolId" AND n."id"=e."noteId" AND n."currentRevision"=e."revisionNumber" AND n."status"='APPROVED' WHERE e."schoolId"=s AND e."id"=source."sourceId" AND e."eventType"='RELEASED' AND phase10_notification_subject(s,n."classId",n."sessionId",n."termId",n."subjectId",n."assignmentId",n."teacherMembershipId") AND phase10_notification_pupil(s,n."classId",n."sessionId",u) AND EXISTS(SELECT 1 FROM "LessonNoteEvent" approved WHERE approved."schoolId"=s AND approved."noteId"=n."id" AND approved."revisionNumber"=n."currentRevision" AND approved."eventType"='APPROVED') AND NOT EXISTS(SELECT 1 FROM "LessonReleaseEvent" withdrawn WHERE withdrawn."schoolId"=s AND withdrawn."noteId"=n."id" AND withdrawn."revisionNumber"=n."currentRevision" AND withdrawn."eventType"='WITHDRAWN'));
 ELSIF source."sourceType"='ResultSheetEvidence' THEN
 RETURN EXISTS(SELECT 1 FROM "ResultSheetEvidence" evidence JOIN "Membership" teacher ON teacher."schoolId"=evidence."schoolId" AND teacher."id"=evidence."teacherMembershipId" AND teacher."userId"=evidence."teacherUserId" WHERE evidence."schoolId"=s AND evidence."id"=source."sourceId" AND evidence."teacherUserId"<>u AND phase10_notification_subject(s,evidence."classId",evidence."sessionId",evidence."termId",evidence."subjectId",evidence."assignmentId",evidence."teacherMembershipId") AND phase10_notification_section(s,evidence."classId",u) AND NOT EXISTS(SELECT 1 FROM "ResultSheetReview" review WHERE review."schoolId"=s AND review."evidenceId"=evidence."id"));
 ELSIF source."sourceType"='ResultSheetReview' THEN
 RETURN EXISTS(SELECT 1 FROM "ResultSheetReview" review JOIN "ResultSheetEvidence" evidence ON evidence."schoolId"=review."schoolId" AND evidence."id"=review."evidenceId" JOIN "Membership" teacher ON teacher."schoolId"=evidence."schoolId" AND teacher."id"=evidence."teacherMembershipId" AND teacher."userId"=evidence."teacherUserId" AND teacher."userId"=u WHERE review."schoolId"=s AND review."id"=source."sourceId" AND phase10_notification_subject(s,evidence."classId",evidence."sessionId",evidence."termId",evidence."subjectId",evidence."assignmentId",evidence."teacherMembershipId"));
 END IF;
 RETURN phase10_family_learning_notification(s,event,u);
END;
$$ LANGUAGE plpgsql STABLE;
CREATE TRIGGER "AttendanceCorrectionRequest_source_capture" AFTER INSERT ON "AttendanceCorrectionRequest" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "AttendanceCorrectionDecision_source_capture" AFTER INSERT ON "AttendanceCorrectionDecision" FOR EACH ROW EXECUTE FUNCTION phase10_source_capture();
CREATE TRIGGER "AttendanceRegister_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AttendanceRegister" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "AttendanceCorrectionRequest_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AttendanceCorrectionRequest" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "AttendanceCorrectionDecision_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AttendanceCorrectionDecision" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LessonNote_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LessonNote" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LessonReleaseEvent_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LessonReleaseEvent" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "ResultSheetReview_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ResultSheetReview" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();

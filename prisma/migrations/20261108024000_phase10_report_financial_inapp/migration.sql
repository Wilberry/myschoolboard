CREATE FUNCTION phase10_learning_resource_notification(s TEXT,event UUID,u TEXT) RETURNS BOOLEAN AS $$
DECLARE source "SchoolSourceEvent"%ROWTYPE;
BEGIN
 SELECT * INTO source FROM "SchoolSourceEvent" WHERE "schoolId"=s AND "id"=event;
 IF source."id" IS NULL THEN RETURN false;END IF;
 IF source."sourceType"='LibraryCatalogRelease' THEN RETURN can_read_library_catalog(s,source."sourceId"::uuid,u);
 ELSIF source."sourceType"='LearningAssetRelease' THEN RETURN can_read_learning_asset(s,source."sourceId"::uuid,u);
 ELSIF source."sourceType"='LearningAssignmentEvent' THEN
 IF source."action"='RELEASE' THEN RETURN can_read_learning_assignment(s,source."sourceId"::uuid,u);END IF;
 RETURN EXISTS(SELECT 1 FROM "LearningAssignmentEvent" e JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" WHERE e."schoolId"=s AND e."id"=source."sourceId"::uuid AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentRevision" v WHERE v."schoolId"=s AND v."taskId"=a."id" AND v."revision">e."revision") AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" newer WHERE newer."schoolId"=s AND newer."taskId"=a."id" AND newer."ordinal">e."ordinal") AND ((e."action"='SUBMIT' AND phase10_task_reviewer(a,u)) OR (e."action" IN ('APPROVE','RETURN') AND a."authorUserId"=u AND phase10_task_author(a))));
 ELSIF source."sourceType"='LearningSubmissionRevision' THEN
 RETURN EXISTS(SELECT 1 FROM "LearningSubmissionRevision" submitted JOIN "LearningAssignmentEvent" e ON e."schoolId"=submitted."schoolId" AND e."id"=submitted."releaseId" JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN LATERAL phase10_task_pupil(s,e."id",submitted."actorUserId") child ON child."studentId"=submitted."studentId" AND child."enrollmentId"=submitted."enrollmentId" WHERE submitted."schoolId"=s AND submitted."id"=source."sourceId"::uuid AND a."authorUserId"=u AND phase10_task_author(a) AND can_read_learning_assignment(s,e."id",u) AND NOT EXISTS(SELECT 1 FROM "LearningSubmissionRevision" newer WHERE newer."schoolId"=s AND newer."releaseId"=e."id" AND newer."studentId"=submitted."studentId" AND newer."revision">submitted."revision") AND NOT EXISTS(SELECT 1 FROM "LearningSubmissionReview" reviewed WHERE reviewed."schoolId"=s AND reviewed."submissionId"=submitted."id"));
 ELSIF source."sourceType"='LearningSubmissionReview' THEN
 RETURN EXISTS(SELECT 1 FROM "LearningSubmissionReview" review JOIN "LearningSubmissionRevision" submitted ON submitted."schoolId"=review."schoolId" AND submitted."id"=review."submissionId" JOIN LATERAL phase10_task_pupil(s,submitted."releaseId",u) child ON child."studentId"=submitted."studentId" AND child."enrollmentId"=submitted."enrollmentId" WHERE review."schoolId"=s AND review."id"=source."sourceId"::uuid AND submitted."actorUserId"=u AND NOT EXISTS(SELECT 1 FROM "LearningSubmissionRevision" newer WHERE newer."schoolId"=s AND newer."releaseId"=submitted."releaseId" AND newer."studentId"=submitted."studentId" AND newer."revision">submitted."revision"));
 END IF;
 RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;
-- Match the accepted report reader, including active subject and no older
-- publication fallback after a newer composition has been published.
CREATE FUNCTION phase10_current_report(s TEXT,p TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "ReportPublication" publication JOIN "School" school ON school."id"=publication."schoolId" AND school."isActive" JOIN "PrivateOfficialReportComposition" c ON c."schoolId"=publication."schoolId" AND c."id"=publication."compositionId" JOIN "ResultReportCardSourcePacket" packet ON packet."schoolId"=c."schoolId" AND packet."id"=c."sourcePacketId" JOIN "Subject" subject ON subject."schoolId"=c."schoolId" AND subject."id"=c."subjectId" AND subject."isActive" WHERE publication."schoolId"=s AND publication."id"=p AND NOT EXISTS(SELECT 1 FROM "ReportPublicationWithdrawal" w WHERE w."schoolId"=s AND w."publicationId"=p) AND NOT EXISTS(SELECT 1 FROM "ReportPublication" newer JOIN "PrivateOfficialReportComposition" nc ON nc."schoolId"=newer."schoolId" AND nc."id"=newer."compositionId" WHERE nc."schoolId"=c."schoolId" AND nc."classId"=c."classId" AND nc."subjectId"=c."subjectId" AND nc."termId"=c."termId" AND nc."sessionId"=c."sessionId" AND nc."evidenceRevision">c."evidenceRevision"));
$$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION can_read_module_notification(s TEXT,event UUID,u TEXT) RETURNS BOOLEAN AS $$
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
CREATE TRIGGER "ReportPublication_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ReportPublication" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "ReportPublicationWithdrawal_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ReportPublicationWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "ReportGuardianAcknowledgment_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ReportGuardianAcknowledgment" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "FeeAccountRelease_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "FeeAccountRelease" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "FeeReceipt_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "FeeReceipt" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "PaymentVerificationDecision_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "PaymentVerificationDecision" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "GuardianStudentLinkRevocation_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "GuardianStudentLinkRevocation" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();

-- Serialize delivery validation with a recipient membership revocation.
CREATE OR REPLACE FUNCTION phase10_delivery() RETURNS trigger AS $$
DECLARE recipient TEXT; r UUID;
BEGIN
 PERFORM 1 FROM "Membership" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."recipientMembershipId" FOR SHARE;
 SELECT d."releaseId" INTO r FROM "DomainEvent" d WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."eventId" AND d."kind"='NOTICE_PUBLISHED';
 SELECT "userId" INTO recipient FROM "Membership" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."recipientMembershipId";
 IF r IS NULL OR recipient IS NULL OR NEW."releaseId"<>r OR NOT can_read_notice(NEW."schoolId",r,recipient) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION phase10_class_delivery() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "Membership" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."recipientMembershipId" FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."recipientMembershipId" AND can_read_class_announcement(NEW."schoolId",NEW."eventId",m."userId")) THEN RAISE EXCEPTION 'Unavailable class recipient' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION phase10_module_delivery() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "Membership" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."recipientMembershipId" FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."recipientMembershipId" AND can_read_module_notification(NEW."schoolId",NEW."eventId",m."userId")) THEN RAISE EXCEPTION 'Unavailable class recipient' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;

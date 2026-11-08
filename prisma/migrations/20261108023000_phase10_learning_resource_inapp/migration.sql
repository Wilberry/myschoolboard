-- Current source-owned predicates; unknown source types never authorize delivery.
CREATE FUNCTION can_read_module_notification(s TEXT,event UUID,u TEXT) RETURNS BOOLEAN AS $$
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
CREATE TABLE "ModuleDelivery" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"recipientMembershipId" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","eventId","recipientMembershipId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","eventId") REFERENCES "SchoolSourceEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","recipientMembershipId") REFERENCES "Membership"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "ModuleDelivery_inbox" ON "ModuleDelivery"("schoolId","recipientMembershipId","createdAt" DESC,"id" DESC);
CREATE TABLE "ModuleDeliveryInteraction" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"deliveryId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('READ','UNREAD')),"requestKey" UUID NOT NULL,"ordinal" BIGINT GENERATED ALWAYS AS IDENTITY,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","deliveryId") REFERENCES "ModuleDelivery"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ModuleDeliverySuppression" (
 "deliveryId" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","deliveryId") REFERENCES "ModuleDelivery"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ModuleOutboxAttempt" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"outcome" TEXT NOT NULL CHECK("outcome" IN ('PAGE','DONE','FAILED','REPLAY')),"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","eventId") REFERENCES "SchoolSourceOutbox"("schoolId","eventId") DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION phase10_module_delivery() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."recipientMembershipId" AND can_read_module_notification(NEW."schoolId",NEW."eventId",m."userId")) THEN RAISE EXCEPTION 'Unavailable class recipient' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ModuleDelivery_validate" BEFORE INSERT ON "ModuleDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_module_delivery();
CREATE FUNCTION phase10_module_interaction() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ModuleDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=NEW."actorUserId" WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."deliveryId" AND can_read_module_notification(d."schoolId",d."eventId",NEW."actorUserId") AND NOT EXISTS(SELECT 1 FROM "ModuleDeliverySuppression" x WHERE x."deliveryId"=d."id")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ModuleDeliveryInteraction_validate" BEFORE INSERT ON "ModuleDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_module_interaction();
CREATE FUNCTION phase10_module_attempt() RETURNS trigger AS $$
BEGIN
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ModuleOutboxAttempt_validate" BEFORE INSERT ON "ModuleOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_module_attempt();
CREATE FUNCTION phase10_module_suppression_validate() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ModuleDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."deliveryId" AND NOT can_read_module_notification(d."schoolId",d."eventId",m."userId")) THEN RAISE EXCEPTION 'Invalid suppression' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ModuleDeliverySuppression_validate" BEFORE INSERT ON "ModuleDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppression_validate();
CREATE TRIGGER "ModuleDelivery_immutable" BEFORE UPDATE OR DELETE ON "ModuleDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleDelivery_no_truncate" BEFORE TRUNCATE ON "ModuleDelivery" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleDeliveryInteraction_immutable" BEFORE UPDATE OR DELETE ON "ModuleDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleDeliveryInteraction_no_truncate" BEFORE TRUNCATE ON "ModuleDeliveryInteraction" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleDeliverySuppression_immutable" BEFORE UPDATE OR DELETE ON "ModuleDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleDeliverySuppression_no_truncate" BEFORE TRUNCATE ON "ModuleDeliverySuppression" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleOutboxAttempt_immutable" BEFORE UPDATE OR DELETE ON "ModuleOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ModuleOutboxAttempt_no_truncate" BEFORE TRUNCATE ON "ModuleOutboxAttempt" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
ALTER TABLE "ModuleOutboxAttempt" ADD COLUMN "requestKey" UUID;
CREATE UNIQUE INDEX "ModuleOutboxAttempt_schoolId_requestKey_key" ON "ModuleOutboxAttempt"("schoolId","requestKey");
ALTER TABLE "ModuleOutboxAttempt" ADD CONSTRAINT "ModuleOutboxAttempt_replay_key" CHECK(("outcome"='REPLAY')=("requestKey" IS NOT NULL));
CREATE UNIQUE INDEX "ModuleDeliverySuppression_schoolId_deliveryId_key" ON "ModuleDeliverySuppression"("schoolId","deliveryId");
CREATE INDEX "ModuleDeliveryInteraction_latest" ON "ModuleDeliveryInteraction"("schoolId","deliveryId","ordinal" DESC);
CREATE FUNCTION phase10_module_suppress() RETURNS trigger AS $$
DECLARE old_data JSONB;new_data JSONB;old_school TEXT;new_school TEXT;school TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN old_data:=to_jsonb(OLD);END IF;
 IF TG_OP<>'DELETE' THEN new_data:=to_jsonb(NEW);END IF;
 IF TG_TABLE_NAME='School' THEN old_school:=old_data->>'id';new_school:=new_data->>'id';
 ELSIF TG_TABLE_NAME='ScopeGrant' THEN
 SELECT "schoolId" INTO old_school FROM "Membership" WHERE "id"=old_data->>'membershipId';
 SELECT "schoolId" INTO new_school FROM "Membership" WHERE "id"=new_data->>'membershipId';
 ELSE old_school:=old_data->>'schoolId';new_school:=new_data->>'schoolId';END IF;
 FOR school IN SELECT DISTINCT value FROM unnest(ARRAY[old_school,new_school]) value WHERE value IS NOT NULL LOOP
 IF EXISTS(SELECT 1 FROM "School" WHERE "id"=school) THEN
 INSERT INTO "ModuleDeliverySuppression"("deliveryId","schoolId") SELECT d."id",d."schoolId" FROM "ModuleDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=school AND NOT can_read_module_notification(d."schoolId",d."eventId",m."userId") ON CONFLICT DO NOTHING;
 END IF;
 END LOOP;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Membership_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Membership" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "School_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "School" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "SchoolClass_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolClass" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "SchoolSection_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolSection" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "AcademicSession_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicSession" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "AcademicTerm_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicTerm" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "Subject_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Subject" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "TeacherClassSubjectAssignment_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "TeacherClassSubjectAssignment" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "FormTeacherResponsibility_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "FormTeacherResponsibility" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "ScopeGrant_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ScopeGrant" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "StudentRecord_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentRecord" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "StudentEnrollment_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentEnrollment" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "StudentAccountLinkRevocation_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentAccountLinkRevocation" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningAssignmentEvent_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningAssignmentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningSubmissionRevision_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningSubmissionRevision" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningSubmissionReview_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningSubmissionReview" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LibraryCatalogReview_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LibraryCatalogReview" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LibraryCatalogRelease_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LibraryCatalogRelease" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LibraryCatalogWithdrawal_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LibraryCatalogWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningAssetRights_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningAssetRights" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningAssetRelease_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningAssetRelease" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();
CREATE TRIGGER "LearningAssetWithdrawal_module_suppression" AFTER INSERT OR UPDATE OR DELETE ON "LearningAssetWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_module_suppress();

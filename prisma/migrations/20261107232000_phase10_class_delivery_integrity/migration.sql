-- Forward hardening: indexed tenant-local suppression and explicit event kind.
CREATE UNIQUE INDEX "ClassDeliverySuppression_schoolId_deliveryId_key" ON "ClassDeliverySuppression"("schoolId","deliveryId");
CREATE INDEX "ClassDeliveryInteraction_latest" ON "ClassDeliveryInteraction"("schoolId","deliveryId","ordinal" DESC);
CREATE FUNCTION phase10_class_outbox_validate() RETURNS trigger AS $$
BEGIN
 IF NEW."state"<>'PENDING' OR NEW."failures"<>0 OR NEW."cursorMembershipId" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" e WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."eventId" AND e."action" IN ('RELEASE','WITHDRAW')) THEN RAISE EXCEPTION 'Invalid class source event' USING ERRCODE='23503';END IF;
 NEW."nextAttemptAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassOutbox_validate" BEFORE INSERT ON "ClassOutbox" FOR EACH ROW EXECUTE FUNCTION phase10_class_outbox_validate();
CREATE OR REPLACE FUNCTION phase10_class_suppress() RETURNS trigger AS $$
DECLARE data JSONB;s TEXT;
BEGIN
 IF TG_OP='DELETE' THEN data:=to_jsonb(OLD);ELSE data:=to_jsonb(NEW);END IF;
 IF TG_TABLE_NAME='School' THEN s:=data->>'id';
 ELSIF TG_TABLE_NAME='ScopeGrant' THEN SELECT "schoolId" INTO s FROM "Membership" WHERE "id"=data->>'membershipId';
 ELSE s:=data->>'schoolId';END IF;
 INSERT INTO "ClassDeliverySuppression"("deliveryId","schoolId") SELECT d."id",d."schoolId" FROM "ClassDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=s AND NOT can_read_class_announcement(d."schoolId",d."eventId",m."userId") ON CONFLICT DO NOTHING;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER "ClassAnnouncementEvent_class_suppression" ON "ClassAnnouncementEvent";
CREATE TRIGGER "ClassAnnouncementEvent_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ClassAnnouncementEvent" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "Membership_class_suppression" ON "Membership";
CREATE TRIGGER "Membership_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Membership" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "School_class_suppression" ON "School";
CREATE TRIGGER "School_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "School" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "SchoolClass_class_suppression" ON "SchoolClass";
CREATE TRIGGER "SchoolClass_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolClass" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "SchoolSection_class_suppression" ON "SchoolSection";
CREATE TRIGGER "SchoolSection_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolSection" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "AcademicSession_class_suppression" ON "AcademicSession";
CREATE TRIGGER "AcademicSession_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicSession" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "AcademicTerm_class_suppression" ON "AcademicTerm";
CREATE TRIGGER "AcademicTerm_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicTerm" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "Subject_class_suppression" ON "Subject";
CREATE TRIGGER "Subject_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Subject" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "TeacherClassSubjectAssignment_class_suppression" ON "TeacherClassSubjectAssignment";
CREATE TRIGGER "TeacherClassSubjectAssignment_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "TeacherClassSubjectAssignment" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "FormTeacherResponsibility_class_suppression" ON "FormTeacherResponsibility";
CREATE TRIGGER "FormTeacherResponsibility_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "FormTeacherResponsibility" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "ScopeGrant_class_suppression" ON "ScopeGrant";
CREATE TRIGGER "ScopeGrant_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ScopeGrant" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "StudentRecord_class_suppression" ON "StudentRecord";
CREATE TRIGGER "StudentRecord_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentRecord" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "StudentEnrollment_class_suppression" ON "StudentEnrollment";
CREATE TRIGGER "StudentEnrollment_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentEnrollment" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();
DROP TRIGGER "StudentAccountLinkRevocation_class_suppression" ON "StudentAccountLinkRevocation";
CREATE TRIGGER "StudentAccountLinkRevocation_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentAccountLinkRevocation" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppress();

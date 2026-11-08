CREATE TABLE "ClassOutbox" (
 "eventId" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"state" TEXT NOT NULL DEFAULT 'PENDING' CHECK("state" IN ('PENDING','DONE','RETRY_WAIT','DEAD_LETTER')),"cursorMembershipId" TEXT,"failures" INTEGER NOT NULL DEFAULT 0 CHECK("failures" BETWEEN 0 AND 5),"nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","eventId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","eventId") REFERENCES "ClassAnnouncementEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "ClassOutbox_due" ON "ClassOutbox"("schoolId","state","nextAttemptAt","eventId");
CREATE TABLE "ClassDelivery" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"recipientMembershipId" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","eventId","recipientMembershipId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","eventId") REFERENCES "ClassAnnouncementEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","recipientMembershipId") REFERENCES "Membership"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "ClassDelivery_inbox" ON "ClassDelivery"("schoolId","recipientMembershipId","createdAt" DESC,"id" DESC);
CREATE TABLE "ClassDeliveryInteraction" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"deliveryId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('READ','UNREAD')),"requestKey" UUID NOT NULL,"ordinal" BIGINT GENERATED ALWAYS AS IDENTITY,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","deliveryId") REFERENCES "ClassDelivery"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ClassDeliverySuppression" (
 "deliveryId" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","deliveryId") REFERENCES "ClassDelivery"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ClassOutboxAttempt" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"outcome" TEXT NOT NULL CHECK("outcome" IN ('PAGE','DONE','FAILED','REPLAY')),"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","eventId") REFERENCES "ClassOutbox"("schoolId","eventId") DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION phase10_class_capture() RETURNS trigger AS $$
BEGIN
 IF NEW."action" IN ('RELEASE','WITHDRAW') THEN INSERT INTO "ClassOutbox"("schoolId","eventId") VALUES(NEW."schoolId",NEW."id");END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassAnnouncementEvent_capture" AFTER INSERT ON "ClassAnnouncementEvent" FOR EACH ROW EXECUTE FUNCTION phase10_class_capture();
CREATE FUNCTION phase10_class_delivery() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."recipientMembershipId" AND can_read_class_announcement(NEW."schoolId",NEW."eventId",m."userId")) THEN RAISE EXCEPTION 'Unavailable class recipient' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassDelivery_validate" BEFORE INSERT ON "ClassDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_class_delivery();
CREATE FUNCTION phase10_class_interaction() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ClassDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=NEW."actorUserId" WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."deliveryId" AND can_read_class_announcement(d."schoolId",d."eventId",NEW."actorUserId") AND NOT EXISTS(SELECT 1 FROM "ClassDeliverySuppression" x WHERE x."deliveryId"=d."id")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassDeliveryInteraction_validate" BEFORE INSERT ON "ClassDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_class_interaction();
CREATE FUNCTION phase10_class_attempt() RETURNS trigger AS $$
BEGIN
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassOutboxAttempt_validate" BEFORE INSERT ON "ClassOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_class_attempt();
CREATE FUNCTION phase10_class_suppress() RETURNS trigger AS $$
BEGIN
 INSERT INTO "ClassDeliverySuppression"("deliveryId","schoolId") SELECT d."id",d."schoolId" FROM "ClassDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE NOT can_read_class_announcement(d."schoolId",d."eventId",m."userId") ON CONFLICT DO NOTHING;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE FUNCTION phase10_class_suppression_validate() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ClassDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."deliveryId" AND NOT can_read_class_announcement(d."schoolId",d."eventId",m."userId")) THEN RAISE EXCEPTION 'Invalid suppression' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassDeliverySuppression_validate" BEFORE INSERT ON "ClassDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_class_suppression_validate();
CREATE TRIGGER "ClassDelivery_immutable" BEFORE UPDATE OR DELETE ON "ClassDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassDelivery_no_truncate" BEFORE TRUNCATE ON "ClassDelivery" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassDeliveryInteraction_immutable" BEFORE UPDATE OR DELETE ON "ClassDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassDeliveryInteraction_no_truncate" BEFORE TRUNCATE ON "ClassDeliveryInteraction" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassDeliverySuppression_immutable" BEFORE UPDATE OR DELETE ON "ClassDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassDeliverySuppression_no_truncate" BEFORE TRUNCATE ON "ClassDeliverySuppression" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassOutboxAttempt_immutable" BEFORE UPDATE OR DELETE ON "ClassOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassOutboxAttempt_no_truncate" BEFORE TRUNCATE ON "ClassOutboxAttempt" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncementEvent_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ClassAnnouncementEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "Membership_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Membership" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "School_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "School" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "SchoolClass_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolClass" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "SchoolSection_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "SchoolSection" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "AcademicSession_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicSession" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "AcademicTerm_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "AcademicTerm" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "Subject_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "Subject" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "TeacherClassSubjectAssignment_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "TeacherClassSubjectAssignment" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "FormTeacherResponsibility_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "FormTeacherResponsibility" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "ScopeGrant_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "ScopeGrant" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "StudentRecord_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentRecord" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "StudentEnrollment_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentEnrollment" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();
CREATE TRIGGER "StudentAccountLinkRevocation_class_suppression" AFTER INSERT OR UPDATE OR DELETE ON "StudentAccountLinkRevocation" FOR EACH STATEMENT EXECUTE FUNCTION phase10_class_suppress();

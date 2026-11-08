-- Independent Phase 11 source contract. No Phase 10 service/table dependency,
-- no history backfill, recipient list, content body or delivery claim.
CREATE TABLE "TrashEventOutbox" (
 "eventId" UUID PRIMARY KEY REFERENCES "TrashEvent"("id") ON DELETE CASCADE,
 "schoolId" TEXT NOT NULL,"caseId" UUID NOT NULL,
 "schemaVersion" INTEGER NOT NULL DEFAULT 1 CHECK("schemaVersion"=1),
 "action" TEXT NOT NULL,"sourceVersion" INTEGER NOT NULL,
 "actorUserId" TEXT NOT NULL,"occurredAt" TIMESTAMPTZ NOT NULL,
 "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "TrashEventOutbox_schoolId_occurredAt_eventId_idx" ON "TrashEventOutbox"("schoolId","occurredAt" DESC,"eventId");
CREATE FUNCTION phase11_outbox_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth()<2 OR NOT EXISTS(SELECT 1 FROM "TrashEvent" e WHERE e."id"=NEW."eventId" AND e."schoolId"=NEW."schoolId" AND e."caseId"=NEW."caseId" AND e."version"=NEW."sourceVersion" AND e."action"=NEW."action" AND e."actorUserId"=NEW."actorUserId" AND e."createdAt"=NEW."occurredAt") THEN RAISE EXCEPTION 'Lifecycle envelope requires its source event' USING ERRCODE='23503';END IF;
 NEW."capturedAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER "TrashEventOutbox_validate" BEFORE INSERT ON "TrashEventOutbox" FOR EACH ROW EXECUTE FUNCTION phase11_outbox_validate();
CREATE TRIGGER "TrashEventOutbox_immutable" BEFORE UPDATE OR DELETE ON "TrashEventOutbox" FOR EACH ROW EXECUTE FUNCTION phase11_immutable();
CREATE TRIGGER "TrashEventOutbox_no_truncate" BEFORE TRUNCATE ON "TrashEventOutbox" FOR EACH STATEMENT EXECUTE FUNCTION phase11_immutable();
CREATE FUNCTION phase11_outbox_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "TrashEventOutbox"("eventId","schoolId","caseId","action","sourceVersion","actorUserId","occurredAt") VALUES(NEW."id",NEW."schoolId",NEW."caseId",NEW."action",NEW."version",NEW."actorUserId",NEW."createdAt");RETURN NULL;
END $$;
CREATE TRIGGER "TrashEvent_outbox_capture" AFTER INSERT ON "TrashEvent" FOR EACH ROW EXECUTE FUNCTION phase11_outbox_capture();

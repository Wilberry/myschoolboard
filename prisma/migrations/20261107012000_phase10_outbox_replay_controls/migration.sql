ALTER TABLE "OutboxAttemptEvent" ADD COLUMN "operatorUserId" TEXT;
ALTER TABLE "OutboxDispatch" ADD CONSTRAINT "OutboxDispatch_valid_lease" CHECK (("state"='LEASED')=("leaseToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL));
ALTER TABLE "OutboxDispatch" ADD CONSTRAINT "OutboxDispatch_bounded_failures" CHECK("failures" BETWEEN 0 AND 5 AND "attempt">=0);
CREATE TABLE "OutboxReplayEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"operatorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId","eventId") REFERENCES "DomainEvent"("schoolId","id") ON DELETE CASCADE
);
CREATE FUNCTION phase10_attempt_operator() RETURNS trigger AS $$
BEGIN IF NEW."operatorUserId" IS NULL OR NOT EXISTS(SELECT 1 FROM "User" u WHERE u."id"=NEW."operatorUserId" AND (u."platformRole"='SUPER_ADMIN' OR phase10_owner(NEW."schoolId",u."id"))) THEN RAISE EXCEPTION 'Current worker authority required' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OutboxAttemptEvent_operator" BEFORE INSERT ON "OutboxAttemptEvent" FOR EACH ROW EXECUTE FUNCTION phase10_attempt_operator();
CREATE FUNCTION phase10_replay_outbox() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "User" u WHERE u."id"=NEW."operatorUserId" AND (u."platformRole"='SUPER_ADMIN' OR phase10_owner(NEW."schoolId",u."id"))) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 PERFORM 1 FROM "OutboxDispatch" WHERE "schoolId"=NEW."schoolId" AND "eventId"=NEW."eventId" AND "state"='DEAD_LETTER' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Replay requires a terminal failed event' USING ERRCODE='23514';END IF;
 UPDATE "OutboxDispatch" SET "state"='PENDING',"failures"=0,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"nextAttemptAt"=clock_timestamp() WHERE "schoolId"=NEW."schoolId" AND "eventId"=NEW."eventId";NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OutboxReplayEvent_validate" BEFORE INSERT ON "OutboxReplayEvent" FOR EACH ROW EXECUTE FUNCTION phase10_replay_outbox();
CREATE TRIGGER "OutboxReplayEvent_immutable" BEFORE UPDATE OR DELETE ON "OutboxReplayEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "OutboxReplayEvent_no_truncate" BEFORE TRUNCATE ON "OutboxReplayEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

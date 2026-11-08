-- Separate personal-account and restricted platform-security notification delivery.
ALTER TABLE "AuthSecurityOutbox" DROP CONSTRAINT "AuthSecurityOutbox_state_check";
ALTER TABLE "AuthSecurityOutbox" ADD CONSTRAINT "AuthSecurityOutbox_state_check" CHECK("state" IN ('PENDING','RETRY_WAIT','DEAD_LETTER','DONE'));
ALTER TABLE "AuthSecurityOutbox" ADD COLUMN "failures" INTEGER NOT NULL DEFAULT 0 CHECK("failures" BETWEEN 0 AND 5),ADD COLUMN "cursorUserId" TEXT,ADD COLUMN "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();
CREATE INDEX "AuthSecurityOutbox_due" ON "AuthSecurityOutbox"("state","nextAttemptAt","eventId");
CREATE INDEX "User_platformRole_id_idx" ON "User"("platformRole","id");
CREATE TABLE "SecurityDelivery" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"eventId" UUID NOT NULL REFERENCES "AuthSecurityEvidence"("id") ON DELETE NO ACTION,
 "recipientUserId" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE("eventId","recipientUserId")
);
CREATE INDEX "SecurityDelivery_user_time" ON "SecurityDelivery"("recipientUserId","createdAt" DESC,"id");
CREATE TABLE "SecurityDeliverySuppression" (
 "deliveryId" UUID PRIMARY KEY REFERENCES "SecurityDelivery"("id") ON DELETE NO ACTION,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE "SecurityDeliveryInteraction" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"deliveryId" UUID NOT NULL REFERENCES "SecurityDelivery"("id") ON DELETE NO ACTION,
 "actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('READ','UNREAD')),
 "ordinal" BIGSERIAL UNIQUE,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),UNIQUE("deliveryId","requestKey")
);
CREATE INDEX "SecurityDeliveryInteraction_latest" ON "SecurityDeliveryInteraction"("deliveryId","ordinal" DESC);
CREATE TABLE "SecurityOutboxAttempt" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),"eventId" UUID NOT NULL REFERENCES "AuthSecurityOutbox"("eventId") ON DELETE NO ACTION,
 "actorUserId" TEXT NOT NULL,"outcome" TEXT NOT NULL CHECK("outcome" IN ('PAGE','DONE','FAILED','REPLAY')),
 "reason" VARCHAR(500) NOT NULL CHECK(char_length(btrim("reason"))>=5),"requestKey" UUID UNIQUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),CHECK(("outcome"='REPLAY')=("requestKey" IS NOT NULL))
);
CREATE FUNCTION phase10_security_recipient(event_id UUID,actor_id TEXT) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM "AuthSecurityEvidence" e JOIN "User" recipient ON recipient."id"=actor_id WHERE e."id"=event_id AND (e."subjectUserId"=actor_id OR (e."subjectUserId" IS NULL AND recipient."platformRole"='SUPER_ADMIN')))
$$;
CREATE FUNCTION phase10_security_delivery_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE "id"=NEW."recipientUserId" FOR SHARE;
 IF NOT FOUND OR NOT phase10_security_recipient(NEW."eventId",NEW."recipientUserId") THEN RAISE EXCEPTION 'Unavailable security recipient' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER "SecurityDelivery_validate" BEFORE INSERT ON "SecurityDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_security_delivery_validate();
CREATE FUNCTION phase10_security_interaction_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE "id"=NEW."actorUserId" FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "SecurityDelivery" d WHERE d."id"=NEW."deliveryId" AND d."recipientUserId"=NEW."actorUserId" AND phase10_security_recipient(d."eventId",NEW."actorUserId") AND NOT EXISTS(SELECT 1 FROM "SecurityDeliverySuppression" x WHERE x."deliveryId"=d."id")) THEN RAISE EXCEPTION 'Unavailable security delivery' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER "SecurityDeliveryInteraction_validate" BEFORE INSERT ON "SecurityDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_security_interaction_validate();
CREATE FUNCTION phase10_security_attempt_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE "id"=NEW."actorUserId" AND "platformRole"='SUPER_ADMIN' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable security operator' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER "SecurityOutboxAttempt_validate" BEFORE INSERT ON "SecurityOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_security_attempt_validate();
CREATE FUNCTION phase10_security_suppression_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "SecurityDelivery" d WHERE d."id"=NEW."deliveryId" AND NOT phase10_security_recipient(d."eventId",d."recipientUserId")) THEN RAISE EXCEPTION 'Invalid security suppression' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER "SecurityDeliverySuppression_validate" BEFORE INSERT ON "SecurityDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_security_suppression_validate();
CREATE FUNCTION phase10_security_user_suppress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW."id"=OLD."id" AND NEW."platformRole"=OLD."platformRole" THEN RETURN NULL;END IF;
 INSERT INTO "SecurityDeliverySuppression"("deliveryId") SELECT d."id" FROM "SecurityDelivery" d WHERE d."recipientUserId"=OLD."id" AND NOT phase10_security_recipient(d."eventId",d."recipientUserId") ON CONFLICT DO NOTHING;RETURN NULL;
END $$;
CREATE TRIGGER "User_security_delivery_suppress" AFTER UPDATE OR DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION phase10_security_user_suppress();
CREATE TRIGGER "SecurityDelivery_immutable" BEFORE UPDATE OR DELETE ON "SecurityDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityDelivery_no_truncate" BEFORE TRUNCATE ON "SecurityDelivery" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityDeliverySuppression_immutable" BEFORE UPDATE OR DELETE ON "SecurityDeliverySuppression" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityDeliverySuppression_no_truncate" BEFORE TRUNCATE ON "SecurityDeliverySuppression" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityDeliveryInteraction_immutable" BEFORE UPDATE OR DELETE ON "SecurityDeliveryInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityDeliveryInteraction_no_truncate" BEFORE TRUNCATE ON "SecurityDeliveryInteraction" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityOutboxAttempt_immutable" BEFORE UPDATE OR DELETE ON "SecurityOutboxAttempt" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "SecurityOutboxAttempt_no_truncate" BEFORE TRUNCATE ON "SecurityOutboxAttempt" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();

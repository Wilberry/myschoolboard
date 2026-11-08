-- Global account-security metadata: no school inference, token, email or body.
CREATE TABLE "AuthSecurityEvidence" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "kind" TEXT NOT NULL CHECK("kind" IN ('SESSION_CREATED','SESSION_CHANGED','SESSION_ENDED','AUTH_SUCCEEDED','AUTH_FAILED','LOGOUT_REQUESTED','LOGOUT_COMPLETED','LOGOUT_FAILED')),
 "subjectUserId" TEXT,"actorUserId" TEXT,"sessionRecordId" TEXT,
 "method" TEXT NOT NULL CHECK("method" IN ('DATABASE_SESSION','EMAIL_SIGN_IN','EMAIL_SIGN_UP','SIGN_OUT')),
 "databasePrincipal" TEXT NOT NULL DEFAULT current_user,
 "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "AuthSecurityEvidence_scope" CHECK(("kind"='AUTH_FAILED' AND "subjectUserId" IS NULL AND "actorUserId" IS NULL AND "sessionRecordId" IS NULL) OR ("kind"<>'AUTH_FAILED' AND "subjectUserId" IS NOT NULL)),
 CONSTRAINT "AuthSecurityEvidence_actor" CHECK("actorUserId" IS NULL OR "actorUserId"="subjectUserId")
);
CREATE INDEX "AuthSecurityEvidence_subjectUserId_recordedAt_id_idx" ON "AuthSecurityEvidence"("subjectUserId","recordedAt" DESC,"id");
CREATE INDEX "AuthSecurityEvidence_recordedAt_id_idx" ON "AuthSecurityEvidence"("recordedAt" DESC,"id");
CREATE TABLE "AuthSecurityOutbox" (
 "eventId" UUID PRIMARY KEY REFERENCES "AuthSecurityEvidence"("id") ON DELETE NO ACTION,
 "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK("state" IN ('PENDING','DONE'))
);
CREATE FUNCTION phase10_security_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Security evidence is immutable' USING ERRCODE='23514';END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuthSecurityEvidence_immutable" BEFORE UPDATE OR DELETE ON "AuthSecurityEvidence" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "AuthSecurityEvidence_no_truncate" BEFORE TRUNCATE ON "AuthSecurityEvidence" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();
CREATE FUNCTION phase10_security_capture() RETURNS trigger AS $$
BEGIN
 INSERT INTO "AuthSecurityOutbox"("eventId") VALUES(NEW."id");RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuthSecurityEvidence_outbox" AFTER INSERT ON "AuthSecurityEvidence" FOR EACH ROW EXECUTE FUNCTION phase10_security_capture();
CREATE FUNCTION phase10_session_security() RETURNS trigger AS $$
DECLARE subject TEXT;record_id TEXT;action TEXT;
BEGIN
 IF TG_OP='DELETE' THEN subject:=OLD."userId";record_id:=OLD."id";action:='SESSION_ENDED';
 ELSE subject:=NEW."userId";record_id:=NEW."id";
 IF TG_OP='UPDATE' AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" AND NEW."expiresAt" IS NOT DISTINCT FROM OLD."expiresAt" THEN RETURN NULL;END IF;
 action:=CASE WHEN TG_OP='INSERT' THEN 'SESSION_CREATED' ELSE 'SESSION_CHANGED' END;END IF;
 INSERT INTO "AuthSecurityEvidence"("kind","subjectUserId","sessionRecordId","method") VALUES(action,subject,record_id,'DATABASE_SESSION');RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Session_security_capture" AFTER INSERT OR UPDATE OR DELETE ON "Session" FOR EACH ROW EXECUTE FUNCTION phase10_session_security();

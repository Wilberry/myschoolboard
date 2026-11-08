-- Preserve actual database provenance and prevent invented session facts.
CREATE FUNCTION phase10_security_provenance() RETURNS trigger AS $$
BEGIN
 IF NEW."method"='DATABASE_SESSION' AND pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Session evidence requires its database source' USING ERRCODE='23503';END IF;
 NEW."recordedAt":=clock_timestamp();NEW."databasePrincipal":=current_user;RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuthSecurityEvidence_provenance" BEFORE INSERT ON "AuthSecurityEvidence" FOR EACH ROW EXECUTE FUNCTION phase10_security_provenance();
CREATE TRIGGER "AuthSecurityOutbox_no_delete" BEFORE DELETE ON "AuthSecurityOutbox" FOR EACH ROW EXECUTE FUNCTION phase10_security_immutable();
CREATE TRIGGER "AuthSecurityOutbox_no_truncate" BEFORE TRUNCATE ON "AuthSecurityOutbox" FOR EACH STATEMENT EXECUTE FUNCTION phase10_security_immutable();

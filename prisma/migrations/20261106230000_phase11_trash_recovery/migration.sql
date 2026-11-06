-- Additive lifecycle overlay. Original academic revisions/events are never erased.
CREATE TABLE "TrashCase" (
 "id" UUID PRIMARY KEY, "schoolId" TEXT NOT NULL, "noteId" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'SCHOOL' CHECK ("state" IN ('SCHOOL','PLATFORM','RECOVERY_AVAILABLE','RESTORED','PURGE_BLOCKED')),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), "schoolExpiresAt" TIMESTAMPTZ NOT NULL,
 "platformEnteredAt" TIMESTAMPTZ, "platformExpiresAt" TIMESTAMPTZ, "recoveryExpiresAt" TIMESTAMPTZ,
 "legalHold" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version">=0),
 UNIQUE ("schoolId","id"),
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY ("schoolId","noteId") REFERENCES "LessonNote"("schoolId","id") ON DELETE NO ACTION
);
CREATE UNIQUE INDEX "TrashCase_one_open_source" ON "TrashCase"("schoolId","noteId") WHERE "state"<>'RESTORED';
CREATE INDEX "TrashCase_school_queue" ON "TrashCase"("schoolId","state","createdAt","id");
CREATE INDEX "TrashCase_expiry_queue" ON "TrashCase"("state","schoolExpiresAt","platformExpiresAt");
CREATE TABLE "TrashEvent" (
 "id" UUID PRIMARY KEY, "schoolId" TEXT NOT NULL, "caseId" UUID NOT NULL,
 "action" TEXT NOT NULL CHECK ("action" IN ('TRASH','RESTORE','REMOVE_SCHOOL','EXPIRE_SCHOOL','AUTHORIZE_RECOVERY','EXPIRE_RECOVERY','EXPIRE_PLATFORM','HOLD','RELEASE_HOLD')),
 "actorUserId" TEXT NOT NULL, "requestKey" UUID NOT NULL, "reason" VARCHAR(500) NOT NULL CHECK (length(btrim("reason")) BETWEEN 5 AND 500),
 "version" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE ("schoolId","requestKey"), UNIQUE ("schoolId","caseId","version"),
 FOREIGN KEY ("schoolId","caseId") REFERENCES "TrashCase"("schoolId","id") ON DELETE CASCADE
);
-- Deliberate stable database clock boundary; no application/test override is deployed.
CREATE FUNCTION phase11_now() RETURNS TIMESTAMPTZ LANGUAGE SQL VOLATILE AS $$ SELECT clock_timestamp() $$;
CREATE FUNCTION phase11_source_authorized(s TEXT,n TEXT,u TEXT) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM "LessonNote" l JOIN "School" school ON school."id"=l."schoolId" AND school."isActive"
 JOIN "Membership" m ON m."schoolId"=l."schoolId" AND m."userId"=u AND m."isActive"
 JOIN "Membership" author ON author."id"=l."teacherMembershipId" AND author."schoolId"=l."schoolId" AND author."isActive" AND author."role"='TEACHER'
 JOIN "TeacherClassSubjectAssignment" a ON a."id"=l."assignmentId" AND a."schoolId"=l."schoolId" AND a."membershipId"=author."id" AND a."classId"=l."classId" AND a."subjectId"=l."subjectId" AND a."sessionId"=l."sessionId" AND a."status"='ACTIVE'
 JOIN "AcademicTerm" t ON t."id"=l."termId" AND t."schoolId"=l."schoolId" AND t."sessionId"=l."sessionId" AND t."status"='ACTIVE'
 JOIN "AcademicSession" session ON session."id"=l."sessionId" AND session."schoolId"=l."schoolId" AND session."status"='ACTIVE'
 JOIN "SchoolClass" c ON c."id"=l."classId" AND c."schoolId"=l."schoolId" AND c."isActive"
 JOIN "SchoolSection" section ON section."id"=c."sectionId" AND section."schoolId"=c."schoolId" AND section."isActive"
 JOIN "Subject" subject ON subject."id"=l."subjectId" AND subject."schoolId"=l."schoolId" AND subject."isActive"
 WHERE l."schoolId"=s AND l."id"=n AND ((m."role"='TEACHER' AND m."id"=author."id") OR m."role"='SCHOOL_SUPER_ADMIN'))
$$;
CREATE FUNCTION phase11_case_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 PERFORM 1 FROM "LessonNote" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."noteId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "LessonNote" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."noteId" AND "status"='DRAFT' AND "submittedAt" IS NULL)
 OR EXISTS(SELECT 1 FROM "LessonNoteEvent" WHERE "schoolId"=NEW."schoolId" AND "noteId"=NEW."noteId" AND "eventType" NOT IN ('CREATED','REVISED'))
 OR EXISTS(SELECT 1 FROM "LessonReleaseEvent" WHERE "schoolId"=NEW."schoolId" AND "noteId"=NEW."noteId") THEN RAISE EXCEPTION 'Unsupported lifecycle source' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=phase11_now(); NEW."schoolExpiresAt":=NEW."createdAt"+interval '30 days';
 NEW."state":='SCHOOL'; NEW."version":=0; NEW."legalHold":=false;
 NEW."platformEnteredAt":=NULL;NEW."platformExpiresAt":=NULL;NEW."recoveryExpiresAt":=NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER "TrashCase_validate" BEFORE INSERT ON "TrashCase" FOR EACH ROW EXECUTE FUNCTION phase11_case_insert();
CREATE FUNCTION phase11_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='TrashCase' AND TG_OP='UPDATE' AND pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Lifecycle history is protected' USING ERRCODE='23514';
END $$;
CREATE TRIGGER "TrashCase_immutable" BEFORE UPDATE OR DELETE ON "TrashCase" FOR EACH ROW EXECUTE FUNCTION phase11_immutable();
CREATE TRIGGER "TrashCase_no_truncate" BEFORE TRUNCATE ON "TrashCase" FOR EACH STATEMENT EXECUTE FUNCTION phase11_immutable();
CREATE TRIGGER "TrashEvent_immutable" BEFORE UPDATE OR DELETE ON "TrashEvent" FOR EACH ROW EXECUTE FUNCTION phase11_immutable();
CREATE TRIGGER "TrashEvent_no_truncate" BEFORE TRUNCATE ON "TrashEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase11_immutable();
CREATE FUNCTION phase11_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "TrashCase"%ROWTYPE; stamp TIMESTAMPTZ; platform BOOLEAN; owner BOOLEAN; allowed BOOLEAN;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO c FROM "TrashCase" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."caseId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
 PERFORM 1 FROM "LessonNote" WHERE "schoolId"=c."schoolId" AND "id"=c."noteId" FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM "User" WHERE "id"=NEW."actorUserId" AND "platformRole"='SUPER_ADMIN') INTO platform;
 SELECT EXISTS(SELECT 1 FROM "Membership" m JOIN "School" s ON s."id"=m."schoolId" AND s."isActive" WHERE m."schoolId"=c."schoolId" AND m."userId"=NEW."actorUserId" AND m."isActive" AND m."role"='SCHOOL_SUPER_ADMIN') INTO owner;
 allowed:=phase11_source_authorized(c."schoolId",c."noteId",NEW."actorUserId"); stamp:=phase11_now();
 IF NEW."version"<>c."version" THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='23514'; END IF;
 IF NEW."action"='TRASH' THEN
  IF c."version"<>0 OR NOT allowed THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
 ELSIF NEW."action"='RESTORE' THEN
  IF NOT allowed OR c."legalHold" OR NOT ((c."state"='SCHOOL' AND stamp<c."schoolExpiresAt") OR (c."state"='RECOVERY_AVAILABLE' AND stamp<c."recoveryExpiresAt" AND stamp<c."platformExpiresAt")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."state":='RESTORED';c."recoveryExpiresAt":=NULL;
 ELSIF NEW."action" IN ('REMOVE_SCHOOL','EXPIRE_SCHOOL') THEN
  IF c."state"<>'SCHOOL' OR (NEW."action"='REMOVE_SCHOOL' AND NOT owner) OR (NEW."action"='EXPIRE_SCHOOL' AND (NOT platform OR stamp<c."schoolExpiresAt")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."state":='PLATFORM';c."platformEnteredAt":=CASE WHEN NEW."action"='EXPIRE_SCHOOL' THEN c."schoolExpiresAt" ELSE LEAST(stamp,c."schoolExpiresAt") END;c."platformExpiresAt":=c."platformEnteredAt"+interval '90 days';
 ELSIF NEW."action"='AUTHORIZE_RECOVERY' THEN
  IF NOT platform OR c."legalHold" OR c."state"<>'PLATFORM' OR stamp>=c."platformExpiresAt" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."state":='RECOVERY_AVAILABLE';c."recoveryExpiresAt":=LEAST(stamp+interval '24 hours',c."platformExpiresAt");
 ELSIF NEW."action"='EXPIRE_RECOVERY' THEN
  IF NOT platform OR c."state"<>'RECOVERY_AVAILABLE' OR stamp<c."recoveryExpiresAt" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."state":='PLATFORM';c."recoveryExpiresAt":=NULL;
 ELSIF NEW."action"='EXPIRE_PLATFORM' THEN
  IF NOT platform OR c."state" NOT IN ('PLATFORM','RECOVERY_AVAILABLE') OR stamp<c."platformExpiresAt" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."state":='PURGE_BLOCKED';c."recoveryExpiresAt":=NULL;
 ELSIF NEW."action" IN ('HOLD','RELEASE_HOLD') THEN
  IF NOT platform OR c."state"='RESTORED' OR c."legalHold"=(NEW."action"='HOLD') THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503'; END IF;
  c."legalHold":=NEW."action"='HOLD';
 ELSE RAISE EXCEPTION 'Invalid action' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=stamp;NEW."version":=c."version"+1;
 UPDATE "TrashCase" SET "state"=c."state","platformEnteredAt"=c."platformEnteredAt","platformExpiresAt"=c."platformExpiresAt","recoveryExpiresAt"=c."recoveryExpiresAt","legalHold"=c."legalHold","version"=NEW."version" WHERE "id"=c."id";
 RETURN NEW;
END $$;
CREATE TRIGGER "TrashEvent_transition" BEFORE INSERT ON "TrashEvent" FOR EACH ROW EXECUTE FUNCTION phase11_transition();
-- A case without its first actor-authorized audit event may never commit.
CREATE FUNCTION phase11_require_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "TrashEvent" WHERE "caseId"=NEW."id" AND "schoolId"=NEW."schoolId" AND "action"='TRASH' AND "version"=1) THEN RAISE EXCEPTION 'Initial lifecycle audit required' USING ERRCODE='23514'; END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "TrashCase_initial_event" AFTER INSERT ON "TrashCase" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase11_require_event();
-- No original draft mutation/revision/submission can race a committed trash overlay.
CREATE FUNCTION phase11_protect_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s TEXT; n TEXT;
BEGIN
 IF TG_TABLE_NAME='LessonNote' THEN s:=OLD."schoolId";n:=OLD."id"; ELSE s:=NEW."schoolId";n:=NEW."noteId"; END IF;
 PERFORM 1 FROM "LessonNote" WHERE "schoolId"=s AND "id"=n FOR UPDATE;
 IF EXISTS(SELECT 1 FROM "TrashCase" WHERE "schoolId"=s AND "noteId"=n AND "state"<>'RESTORED') THEN RAISE EXCEPTION 'Trashed draft is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "LessonNote_trash_guard" BEFORE UPDATE ON "LessonNote" FOR EACH ROW EXECUTE FUNCTION phase11_protect_draft();
CREATE TRIGGER "LessonNoteRevision_trash_guard" BEFORE INSERT ON "LessonNoteRevision" FOR EACH ROW EXECUTE FUNCTION phase11_protect_draft();
CREATE TRIGGER "LessonNoteEvent_trash_guard" BEFORE INSERT ON "LessonNoteEvent" FOR EACH ROW EXECUTE FUNCTION phase11_protect_draft();

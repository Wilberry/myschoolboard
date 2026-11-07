-- Official notices only. No class-announcement permissions or external delivery.
CREATE TABLE "Notice" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"authorUserId" TEXT NOT NULL,"authorMembershipId" TEXT NOT NULL,
 "currentRevision" INTEGER NOT NULL DEFAULT 0,"state" TEXT NOT NULL DEFAULT 'DRAFT' CHECK("state" IN ('DRAFT','SUBMITTED','APPROVED','RETURNED')),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","authorMembershipId") REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION
);
CREATE TABLE "NoticeRevision" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"noticeId" UUID NOT NULL,"revision" INTEGER NOT NULL CHECK("revision">0),"title" VARCHAR(160) NOT NULL CHECK(length(btrim("title")) BETWEEN 1 AND 160),"body" TEXT NOT NULL CHECK(length(btrim("body")) BETWEEN 1 AND 20000),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","noticeId","revision"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId","noticeId") REFERENCES "Notice"("schoolId","id") ON DELETE CASCADE
);
CREATE TABLE "NoticeWorkflowEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"noticeId" UUID NOT NULL,"revision" INTEGER NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('SUBMIT','APPROVE','RETURN')),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId","noticeId","revision") REFERENCES "NoticeRevision"("schoolId","noticeId","revision") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "NoticeWorkflowEvent_one_submit" ON "NoticeWorkflowEvent"("schoolId","noticeId","revision") WHERE "action"='SUBMIT';
CREATE UNIQUE INDEX "NoticeWorkflowEvent_one_review" ON "NoticeWorkflowEvent"("schoolId","noticeId","revision") WHERE "action" IN ('APPROVE','RETURN');
CREATE TABLE "NoticePolicyRevision" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"version" INTEGER NOT NULL,"audience" TEXT NOT NULL CHECK("audience" IN ('STAFF_ONLY','STUDENTS_ONLY','GUARDIANS_ONLY','STUDENTS_AND_GUARDIANS')),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","version"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE TABLE "NoticeRelease" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"noticeId" UUID NOT NULL,"revision" INTEGER NOT NULL,"policyId" UUID NOT NULL,"ordinal" INTEGER NOT NULL,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),UNIQUE("schoolId","noticeId","revision"),UNIQUE("schoolId","noticeId","ordinal"),FOREIGN KEY("schoolId","noticeId","revision") REFERENCES "NoticeRevision"("schoolId","noticeId","revision") ON DELETE CASCADE,FOREIGN KEY("schoolId","policyId") REFERENCES "NoticePolicyRevision"("schoolId","id") ON DELETE NO ACTION
);
CREATE TABLE "NoticeWithdrawal" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"releaseId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","releaseId"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId","releaseId") REFERENCES "NoticeRelease"("schoolId","id") ON DELETE CASCADE
);
CREATE TABLE "DomainEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"sourceId" UUID NOT NULL,"kind" TEXT NOT NULL CHECK("kind" IN ('NOTICE_PUBLISHED','NOTICE_WITHDRAWN')),"releaseId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"schemaVersion" INTEGER NOT NULL DEFAULT 1 CHECK("schemaVersion"=1),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","sourceId","kind"),FOREIGN KEY("schoolId","releaseId") REFERENCES "NoticeRelease"("schoolId","id") ON DELETE CASCADE
);
CREATE TABLE "OutboxDispatch" (
 "eventId" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"state" TEXT NOT NULL DEFAULT 'PENDING' CHECK("state" IN ('PENDING','LEASED','RETRY_WAIT','DONE','DEAD_LETTER')),"leaseToken" UUID,"leaseExpiresAt" TIMESTAMPTZ,"nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),"attempt" INTEGER NOT NULL DEFAULT 0,"failures" INTEGER NOT NULL DEFAULT 0,"cursorMembershipId" TEXT,
 FOREIGN KEY("schoolId","eventId") REFERENCES "DomainEvent"("schoolId","id") ON DELETE CASCADE
);
CREATE INDEX "OutboxDispatch_ready" ON "OutboxDispatch"("schoolId","state","nextAttemptAt","eventId");
CREATE TABLE "OutboxAttemptEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"attempt" INTEGER NOT NULL,"outcome" TEXT NOT NULL CHECK("outcome" IN ('CLAIMED','LEASE_EXPIRED','DELIVERED','CONTINUED','SUPPRESSED','RETRY','DEAD_LETTER')),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","eventId","attempt","outcome"),FOREIGN KEY("schoolId","eventId") REFERENCES "DomainEvent"("schoolId","id") ON DELETE CASCADE
);
CREATE TABLE "NotificationDelivery" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"eventId" UUID NOT NULL,"releaseId" UUID NOT NULL,"recipientMembershipId" TEXT NOT NULL,"contextKey" TEXT NOT NULL DEFAULT 'SCHOOL' CHECK("contextKey"='SCHOOL'),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","eventId","recipientMembershipId","contextKey"),FOREIGN KEY("schoolId","eventId") REFERENCES "DomainEvent"("schoolId","id") ON DELETE CASCADE,FOREIGN KEY("schoolId","releaseId") REFERENCES "NoticeRelease"("schoolId","id") ON DELETE CASCADE,FOREIGN KEY("schoolId","recipientMembershipId") REFERENCES "Membership"("schoolId","id") ON DELETE NO ACTION
);
CREATE INDEX "NotificationDelivery_inbox" ON "NotificationDelivery"("schoolId","recipientMembershipId","createdAt" DESC,"id");
CREATE TABLE "NotificationInteraction" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"deliveryId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('READ','UNREAD')),"requestKey" UUID NOT NULL,"ordinal" INTEGER NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","requestKey"),UNIQUE("schoolId","deliveryId","ordinal"),FOREIGN KEY("schoolId","deliveryId") REFERENCES "NotificationDelivery"("schoolId","id") ON DELETE CASCADE
);
CREATE TABLE "NotificationSuppression" (
 "deliveryId" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"reasonCode" TEXT NOT NULL CHECK("reasonCode" IN ('AUTHORITY_REVOKED','SOURCE_WITHDRAWN','SOURCE_SUPERSEDED')),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY("schoolId","deliveryId") REFERENCES "NotificationDelivery"("schoolId","id") ON DELETE CASCADE
);
CREATE FUNCTION phase10_owner(s TEXT,u TEXT) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM "Membership" m JOIN "School" school ON school."id"=m."schoolId" AND school."isActive" WHERE m."schoolId"=s AND m."userId"=u AND m."isActive" AND m."role"='SCHOOL_SUPER_ADMIN');END;
$$ LANGUAGE plpgsql STABLE;
CREATE FUNCTION phase10_recipient(s TEXT,u TEXT,audience TEXT) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM "Membership" m JOIN "School" school ON school."id"=m."schoolId" AND school."isActive" WHERE m."schoolId"=s AND m."userId"=u AND m."isActive" AND (
 (audience='STAFF_ONLY' AND m."role" IN ('SCHOOL_SUPER_ADMIN','SCHOOL_ADMIN','HEAD_OF_SECTION','PRINCIPAL','TEACHER','FORM_TEACHER')) OR
 (audience IN ('STUDENTS_ONLY','STUDENTS_AND_GUARDIANS') AND m."role"='STUDENT' AND EXISTS(SELECT 1 FROM "StudentAccountLink" l JOIN "StudentRecord" p ON p."id"=l."studentId" AND p."schoolId"=l."schoolId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" e ON e."studentId"=p."id" AND e."schoolId"=p."schoolId" AND e."status"='ACTIVE' JOIN "AcademicSession" session ON session."id"=e."sessionId" AND session."schoolId"=e."schoolId" AND session."status"='ACTIVE' JOIN "SchoolClass" c ON c."id"=e."classId" AND c."schoolId"=e."schoolId" AND c."isActive" JOIN "SchoolSection" section ON section."id"=c."sectionId" AND section."schoolId"=c."schoolId" AND section."isActive" WHERE l."schoolId"=s AND l."studentMembershipId"=m."id" AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" r WHERE r."schoolId"=l."schoolId" AND r."linkId"=l."id"))) OR
 (audience IN ('GUARDIANS_ONLY','STUDENTS_AND_GUARDIANS') AND m."role"='PARENT' AND EXISTS(SELECT 1 FROM "GuardianStudentLink" l JOIN "StudentRecord" p ON p."id"=l."studentId" AND p."schoolId"=l."schoolId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" e ON e."studentId"=p."id" AND e."schoolId"=p."schoolId" AND e."status"='ACTIVE' JOIN "AcademicSession" session ON session."id"=e."sessionId" AND session."schoolId"=e."schoolId" AND session."status"='ACTIVE' JOIN "SchoolClass" c ON c."id"=e."classId" AND c."schoolId"=e."schoolId" AND c."isActive" JOIN "SchoolSection" section ON section."id"=c."sectionId" AND section."schoolId"=c."schoolId" AND section."isActive" WHERE l."schoolId"=s AND l."guardianMembershipId"=m."id" AND NOT EXISTS(SELECT 1 FROM "GuardianStudentLinkRevocation" r WHERE r."schoolId"=l."schoolId" AND r."linkId"=l."id")))
 ));END;
$$ LANGUAGE plpgsql STABLE;
CREATE FUNCTION can_read_notice(s TEXT,r UUID,u TEXT) RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS(SELECT 1 FROM "NoticeRelease" release JOIN "NoticePolicyRevision" p ON p."id"=release."policyId" AND p."schoolId"=release."schoolId" WHERE release."schoolId"=s AND release."id"=r AND phase10_recipient(s,u,p."audience") AND NOT EXISTS(SELECT 1 FROM "NoticeWithdrawal" w WHERE w."schoolId"=s AND w."releaseId"=r) AND NOT EXISTS(SELECT 1 FROM "NoticeRelease" later WHERE later."schoolId"=s AND later."noticeId"=release."noticeId" AND later."ordinal">release."ordinal"));END;
$$ LANGUAGE plpgsql STABLE;
CREATE FUNCTION phase10_immutable() RETURNS trigger AS $$
BEGIN IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD;END IF;
 IF TG_TABLE_NAME='Notice' AND TG_OP='UPDATE' AND pg_trigger_depth()>1 THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'Notice history is immutable' USING ERRCODE='23514';END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Notice_projection" BEFORE UPDATE OR DELETE ON "Notice" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "Notice_no_truncate" BEFORE TRUNCATE ON "Notice" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE FUNCTION phase10_notice_create() RETURNS trigger AS $$
DECLARE member TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT m."id" INTO member FROM "Membership" m JOIN "School" s ON s."id"=m."schoolId" AND s."isActive" WHERE m."schoolId"=NEW."schoolId" AND m."userId"=NEW."authorUserId" AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN');
 IF member IS NULL THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."authorMembershipId":=member;NEW."currentRevision":=0;NEW."state":='DRAFT';NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Notice_create" BEFORE INSERT ON "Notice" FOR EACH ROW EXECUTE FUNCTION phase10_notice_create();
CREATE FUNCTION phase10_revision() RETURNS trigger AS $$
DECLARE n "Notice"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO n FROM "Notice" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."noticeId" FOR UPDATE;
 IF NOT FOUND OR n."authorUserId"<>NEW."actorUserId" OR NEW."revision"<>n."currentRevision"+1 OR n."state"='SUBMITTED' OR NOT EXISTS(SELECT 1 FROM "Membership" m JOIN "School" s ON s."id"=m."schoolId" AND s."isActive" WHERE m."schoolId"=n."schoolId" AND m."id"=n."authorMembershipId" AND m."userId"=NEW."actorUserId" AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')) THEN RAISE EXCEPTION 'Unavailable or stale revision' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();UPDATE "Notice" SET "currentRevision"=NEW."revision","state"='DRAFT' WHERE "id"=n."id";RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeRevision_create" BEFORE INSERT ON "NoticeRevision" FOR EACH ROW EXECUTE FUNCTION phase10_revision();
CREATE FUNCTION phase10_initial_revision() RETURNS trigger AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM "NoticeRevision" WHERE "schoolId"=NEW."schoolId" AND "noticeId"=NEW."id" AND "revision"=1) THEN RAISE EXCEPTION 'Initial revision required' USING ERRCODE='23514';END IF;RETURN NULL;END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Notice_initial_revision" AFTER INSERT ON "Notice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase10_initial_revision();
CREATE FUNCTION phase10_workflow() RETURNS trigger AS $$
DECLARE n "Notice"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;SELECT * INTO n FROM "Notice" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."noticeId" FOR UPDATE;
 IF NOT FOUND OR NEW."revision"<>n."currentRevision" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 IF NEW."action"='SUBMIT' THEN
 IF n."state"<>'DRAFT' OR n."authorUserId"<>NEW."actorUserId" OR NOT EXISTS(SELECT 1 FROM "Membership" m JOIN "School" s ON s."id"=m."schoolId" AND s."isActive" WHERE m."schoolId"=n."schoolId" AND m."id"=n."authorMembershipId" AND m."userId"=NEW."actorUserId" AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 UPDATE "Notice" SET "state"='SUBMITTED' WHERE "id"=n."id";
 ELSE
 IF n."state"<>'SUBMITTED' OR NOT phase10_owner(n."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 -- Owner-authored ordinary school notices may be self-reviewed explicitly; an
 -- administrator author can never approve by generic academic/school authority.
 UPDATE "Notice" SET "state"=CASE WHEN NEW."action"='APPROVE' THEN 'APPROVED' ELSE 'RETURNED' END WHERE "id"=n."id";
 END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeWorkflowEvent_validate" BEFORE INSERT ON "NoticeWorkflowEvent" FOR EACH ROW EXECUTE FUNCTION phase10_workflow();
CREATE FUNCTION phase10_policy() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 SELECT COALESCE(MAX("version"),0)+1 INTO NEW."version" FROM "NoticePolicyRevision" WHERE "schoolId"=NEW."schoolId";NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticePolicyRevision_validate" BEFORE INSERT ON "NoticePolicyRevision" FOR EACH ROW EXECUTE FUNCTION phase10_policy();
CREATE FUNCTION phase10_release() RETURNS trigger AS $$
DECLARE n "Notice"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;SELECT * INTO n FROM "Notice" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."noticeId" FOR UPDATE;
 IF NOT FOUND OR n."state"<>'APPROVED' OR n."currentRevision"<>NEW."revision" OR NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR NOT EXISTS(SELECT 1 FROM "NoticeWorkflowEvent" e WHERE e."schoolId"=n."schoolId" AND e."noticeId"=n."id" AND e."revision"=n."currentRevision" AND e."action"='APPROVE') THEN RAISE EXCEPTION 'Unavailable or unreviewed version' USING ERRCODE='23503';END IF;
 SELECT COALESCE(MAX("ordinal"),0)+1 INTO NEW."ordinal" FROM "NoticeRelease" WHERE "schoolId"=n."schoolId" AND "noticeId"=n."id";NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeRelease_validate" BEFORE INSERT ON "NoticeRelease" FOR EACH ROW EXECUTE FUNCTION phase10_release();
CREATE FUNCTION phase10_withdraw() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeWithdrawal_validate" BEFORE INSERT ON "NoticeWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_withdraw();
-- Immutable event capture and delivery invalidation are part of publication's
-- own transaction, never an after-commit best-effort network call.
CREATE FUNCTION phase10_capture() RETURNS trigger AS $$
DECLARE r UUID; k TEXT;
BEGIN
 IF TG_TABLE_NAME='NoticeRelease' THEN r:=NEW."id";ELSE r:=NEW."releaseId";END IF;
 k:=CASE WHEN TG_TABLE_NAME='NoticeRelease' THEN 'NOTICE_PUBLISHED' ELSE 'NOTICE_WITHDRAWN' END;
 INSERT INTO "DomainEvent" ("id","schoolId","sourceId","kind","releaseId","actorUserId") VALUES(NEW."id",NEW."schoolId",NEW."id",k,r,NEW."actorUserId");
 INSERT INTO "OutboxDispatch" ("eventId","schoolId") VALUES(NEW."id",NEW."schoolId");
 IF TG_TABLE_NAME='NoticeWithdrawal' THEN
 INSERT INTO "NotificationSuppression" ("deliveryId","schoolId","reasonCode") SELECT d."id",d."schoolId",'SOURCE_WITHDRAWN' FROM "NotificationDelivery" d WHERE d."schoolId"=NEW."schoolId" AND d."releaseId"=r ON CONFLICT DO NOTHING;
 ELSE
 INSERT INTO "NotificationSuppression" ("deliveryId","schoolId","reasonCode") SELECT d."id",d."schoolId",'SOURCE_SUPERSEDED' FROM "NotificationDelivery" d JOIN "NoticeRelease" older ON older."id"=d."releaseId" AND older."schoolId"=d."schoolId" WHERE older."schoolId"=NEW."schoolId" AND older."noticeId"=NEW."noticeId" AND older."ordinal"<NEW."ordinal" ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeRelease_capture" AFTER INSERT ON "NoticeRelease" FOR EACH ROW EXECUTE FUNCTION phase10_capture();
CREATE TRIGGER "NoticeWithdrawal_capture" AFTER INSERT ON "NoticeWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_capture();
CREATE FUNCTION phase10_delivery() RETURNS trigger AS $$
DECLARE recipient TEXT; r UUID;
BEGIN
 SELECT d."releaseId" INTO r FROM "DomainEvent" d WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."eventId" AND d."kind"='NOTICE_PUBLISHED';
 SELECT "userId" INTO recipient FROM "Membership" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."recipientMembershipId";
 IF r IS NULL OR recipient IS NULL OR NEW."releaseId"<>r OR NOT can_read_notice(NEW."schoolId",r,recipient) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationDelivery_validate" BEFORE INSERT ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_delivery();
CREATE FUNCTION phase10_interaction() RETURNS trigger AS $$
DECLARE d "NotificationDelivery"%ROWTYPE;
BEGIN
 SELECT * INTO d FROM "NotificationDelivery" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."deliveryId" FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "Membership" m WHERE m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" AND m."userId"=NEW."actorUserId") OR NOT can_read_notice(d."schoolId",d."releaseId",NEW."actorUserId") OR EXISTS(SELECT 1 FROM "NotificationSuppression" WHERE "deliveryId"=d."id") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 SELECT COALESCE(MAX("ordinal"),0)+1 INTO NEW."ordinal" FROM "NotificationInteraction" WHERE "schoolId"=d."schoolId" AND "deliveryId"=d."id";NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationInteraction_validate" BEFORE INSERT ON "NotificationInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_interaction();
CREATE FUNCTION phase10_suppress_authority() RETURNS trigger AS $$
DECLARE s TEXT;
BEGIN
 IF TG_TABLE_NAME='School' THEN s:=NEW."id";ELSE s:=NEW."schoolId";END IF;
 INSERT INTO "NotificationSuppression" ("deliveryId","schoolId","reasonCode") SELECT d."id",d."schoolId",'AUTHORITY_REVOKED' FROM "NotificationDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=s AND NOT can_read_notice(d."schoolId",d."releaseId",m."userId") ON CONFLICT DO NOTHING;RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Membership_notice_suppression" AFTER UPDATE ON "Membership" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "School_notice_suppression" AFTER UPDATE ON "School" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "StudentRecord_notice_suppression" AFTER UPDATE ON "StudentRecord" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "StudentEnrollment_notice_suppression" AFTER UPDATE ON "StudentEnrollment" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "SchoolClass_notice_suppression" AFTER UPDATE ON "SchoolClass" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "SchoolSection_notice_suppression" AFTER UPDATE ON "SchoolSection" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "AcademicSession_notice_suppression" AFTER UPDATE ON "AcademicSession" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "GuardianStudentLinkRevocation_notice_suppression" AFTER INSERT ON "GuardianStudentLinkRevocation" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();
CREATE TRIGGER "StudentAccountLinkRevocation_notice_suppression" AFTER INSERT ON "StudentAccountLinkRevocation" FOR EACH ROW EXECUTE FUNCTION phase10_suppress_authority();

CREATE TRIGGER "NoticeRevision_immutable" BEFORE UPDATE OR DELETE ON "NoticeRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NoticeRevision_no_truncate" BEFORE TRUNCATE ON "NoticeRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NoticeWorkflowEvent_immutable" BEFORE UPDATE OR DELETE ON "NoticeWorkflowEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NoticeWorkflowEvent_no_truncate" BEFORE TRUNCATE ON "NoticeWorkflowEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NoticePolicyRevision_immutable" BEFORE UPDATE OR DELETE ON "NoticePolicyRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NoticePolicyRevision_no_truncate" BEFORE TRUNCATE ON "NoticePolicyRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NoticeRelease_immutable" BEFORE UPDATE OR DELETE ON "NoticeRelease" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NoticeRelease_no_truncate" BEFORE TRUNCATE ON "NoticeRelease" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NoticeWithdrawal_immutable" BEFORE UPDATE OR DELETE ON "NoticeWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NoticeWithdrawal_no_truncate" BEFORE TRUNCATE ON "NoticeWithdrawal" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "DomainEvent_immutable" BEFORE UPDATE OR DELETE ON "DomainEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "DomainEvent_no_truncate" BEFORE TRUNCATE ON "DomainEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "OutboxAttemptEvent_immutable" BEFORE UPDATE OR DELETE ON "OutboxAttemptEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "OutboxAttemptEvent_no_truncate" BEFORE TRUNCATE ON "OutboxAttemptEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NotificationDelivery_immutable" BEFORE UPDATE OR DELETE ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NotificationDelivery_no_truncate" BEFORE TRUNCATE ON "NotificationDelivery" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NotificationInteraction_immutable" BEFORE UPDATE OR DELETE ON "NotificationInteraction" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NotificationInteraction_no_truncate" BEFORE TRUNCATE ON "NotificationInteraction" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE TRIGGER "NotificationSuppression_immutable" BEFORE UPDATE OR DELETE ON "NotificationSuppression" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "NotificationSuppression_no_truncate" BEFORE TRUNCATE ON "NotificationSuppression" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

CREATE FUNCTION phase10_domain_event() RETURNS trigger AS $$
BEGIN
 IF NEW."id"<>NEW."sourceId" OR (NEW."kind"='NOTICE_PUBLISHED' AND NOT EXISTS(SELECT 1 FROM "NoticeRelease" r WHERE r."schoolId"=NEW."schoolId" AND r."id"=NEW."sourceId" AND r."id"=NEW."releaseId" AND r."actorUserId"=NEW."actorUserId")) OR (NEW."kind"='NOTICE_WITHDRAWN' AND NOT EXISTS(SELECT 1 FROM "NoticeWithdrawal" w WHERE w."schoolId"=NEW."schoolId" AND w."id"=NEW."sourceId" AND w."releaseId"=NEW."releaseId" AND w."actorUserId"=NEW."actorUserId")) THEN RAISE EXCEPTION 'Invalid domain source' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DomainEvent_validate" BEFORE INSERT ON "DomainEvent" FOR EACH ROW EXECUTE FUNCTION phase10_domain_event();
CREATE FUNCTION phase10_suppression() RETURNS trigger AS $$
DECLARE allowed BOOLEAN;
BEGIN
 SELECT can_read_notice(d."schoolId",d."releaseId",m."userId") INTO allowed FROM "NotificationDelivery" d JOIN "Membership" m ON m."schoolId"=d."schoolId" AND m."id"=d."recipientMembershipId" WHERE d."schoolId"=NEW."schoolId" AND d."id"=NEW."deliveryId";
 IF allowed IS DISTINCT FROM false THEN RAISE EXCEPTION 'Invalid suppression' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationSuppression_validate" BEFORE INSERT ON "NotificationSuppression" FOR EACH ROW EXECUTE FUNCTION phase10_suppression();

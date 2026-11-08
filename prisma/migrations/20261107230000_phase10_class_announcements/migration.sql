-- Separate class channel: no notice, report or guardian audience grants.
CREATE TABLE "ClassAnnouncement" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"authorUserId" TEXT NOT NULL,"authorMembershipId" TEXT NOT NULL,
 "classId" TEXT NOT NULL,"sessionId" TEXT NOT NULL,"termId" TEXT NOT NULL,"subjectId" TEXT,"assignmentId" TEXT,"formResponsibilityId" TEXT,
 "requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(("assignmentId" IS NOT NULL AND "subjectId" IS NOT NULL AND "formResponsibilityId" IS NULL) OR ("assignmentId" IS NULL AND "subjectId" IS NULL AND "formResponsibilityId" IS NOT NULL)),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","authorMembershipId") REFERENCES "Membership"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","termId") REFERENCES "AcademicTerm"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","subjectId") REFERENCES "Subject"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","assignmentId","authorMembershipId","classId","subjectId","sessionId") REFERENCES "TeacherClassSubjectAssignment"("schoolId","id","membershipId","classId","subjectId","sessionId") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","formResponsibilityId") REFERENCES "FormTeacherResponsibility"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ClassAnnouncementRevision" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"announcementId" UUID NOT NULL,"revision" INTEGER NOT NULL CHECK("revision">0),"title" VARCHAR(160) NOT NULL CHECK(length(btrim("title")) BETWEEN 1 AND 160),"body" TEXT NOT NULL CHECK(length(btrim("body")) BETWEEN 1 AND 20000),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","announcementId","revision"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","announcementId") REFERENCES "ClassAnnouncement"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "ClassAnnouncementEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"announcementId" UUID NOT NULL,"revision" INTEGER NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('SUBMIT','APPROVE','RETURN','RELEASE','WITHDRAW')),"targetReleaseId" UUID,
 "actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),"ordinal" BIGINT GENERATED ALWAYS AS IDENTITY,
 CHECK(("action"='WITHDRAW')=("targetReleaseId" IS NOT NULL)),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","announcementId","revision") REFERENCES "ClassAnnouncementRevision"("schoolId","announcementId","revision") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","targetReleaseId") REFERENCES "ClassAnnouncementEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX "ClassAnnouncementEvent_submit_once" ON "ClassAnnouncementEvent"("schoolId","announcementId","revision") WHERE "action"='SUBMIT';
CREATE UNIQUE INDEX "ClassAnnouncementEvent_review_once" ON "ClassAnnouncementEvent"("schoolId","announcementId","revision") WHERE "action" IN ('APPROVE','RETURN');
CREATE UNIQUE INDEX "ClassAnnouncementEvent_release_once" ON "ClassAnnouncementEvent"("schoolId","announcementId","revision") WHERE "action"='RELEASE';
CREATE UNIQUE INDEX "ClassAnnouncementEvent_withdraw_once" ON "ClassAnnouncementEvent"("schoolId","targetReleaseId") WHERE "action"='WITHDRAW';
CREATE INDEX "ClassAnnouncement_scope" ON "ClassAnnouncement"("schoolId","classId","sessionId","termId");
CREATE INDEX "ClassAnnouncementEvent_feed" ON "ClassAnnouncementEvent"("schoolId","action","ordinal" DESC);
CREATE FUNCTION phase10_class_author(p "ClassAnnouncement") RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id" AND m."id"=p."authorMembershipId" AND m."userId"=p."authorUserId" AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER')
 JOIN "SchoolClass" c ON c."schoolId"=s."id" AND c."id"=p."classId" AND c."isActive"
 JOIN "SchoolSection" section ON section."schoolId"=s."id" AND section."id"=c."sectionId" AND section."isActive"
 JOIN "AcademicSession" session ON session."schoolId"=s."id" AND session."id"=p."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=s."id" AND term."id"=p."termId" AND term."sessionId"=session."id" AND term."status"='ACTIVE'
 WHERE s."id"=p."schoolId" AND s."isActive" AND ((p."assignmentId" IS NOT NULL AND EXISTS(SELECT 1 FROM "TeacherClassSubjectAssignment" a JOIN "Subject" subject ON subject."schoolId"=a."schoolId" AND subject."id"=a."subjectId" AND subject."isActive" WHERE a."schoolId"=s."id" AND a."id"=p."assignmentId" AND a."membershipId"=m."id" AND a."classId"=c."id" AND a."sessionId"=session."id" AND a."subjectId"=p."subjectId" AND a."status"='ACTIVE')) OR (p."formResponsibilityId" IS NOT NULL AND EXISTS(SELECT 1 FROM "FormTeacherResponsibility" a WHERE a."schoolId"=s."id" AND a."id"=p."formResponsibilityId" AND a."membershipId"=m."id" AND a."classId"=c."id" AND a."sessionId"=session."id" AND a."status"='ACTIVE'))));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_class_reviewer(p "ClassAnnouncement",u TEXT) RETURNS BOOLEAN AS $$
 SELECT p."authorUserId"<>u AND phase10_class_author(p) AND EXISTS(SELECT 1 FROM "Membership" m JOIN "SchoolClass" c ON c."schoolId"=m."schoolId" AND c."id"=p."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "ScopeGrant" g ON g."membershipId"=m."id" AND g."type"='SECTION' AND g."verified" AND g."scopeId"=section."id" WHERE m."schoolId"=p."schoolId" AND m."userId"=u AND m."isActive" AND ((m."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY') OR (m."role"='PRINCIPAL' AND section."stage"='SECONDARY')));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_class_create() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_class_author(NEW) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassAnnouncement_create" BEFORE INSERT ON "ClassAnnouncement" FOR EACH ROW EXECUTE FUNCTION phase10_class_create();
CREATE FUNCTION phase10_class_revision() RETURNS trigger AS $$
DECLARE a "ClassAnnouncement"%ROWTYPE;latest INTEGER;last_action TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO a FROM "ClassAnnouncement" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."announcementId" FOR UPDATE;
 SELECT COALESCE(MAX("revision"),0) INTO latest FROM "ClassAnnouncementRevision" WHERE "schoolId"=a."schoolId" AND "announcementId"=a."id";
 SELECT "action" INTO last_action FROM "ClassAnnouncementEvent" WHERE "schoolId"=a."schoolId" AND "announcementId"=a."id" AND "revision"=latest AND "action"<>'WITHDRAW' ORDER BY "ordinal" DESC LIMIT 1;
 IF a."id" IS NULL OR a."authorUserId"<>NEW."actorUserId" OR NOT phase10_class_author(a) OR NEW."revision"<>latest+1 OR last_action='SUBMIT' THEN RAISE EXCEPTION 'Unavailable or stale' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassAnnouncementRevision_validate" BEFORE INSERT ON "ClassAnnouncementRevision" FOR EACH ROW EXECUTE FUNCTION phase10_class_revision();
CREATE FUNCTION phase10_class_initial() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "ClassAnnouncementRevision" WHERE "schoolId"=NEW."schoolId" AND "announcementId"=NEW."id" AND "revision"=1) THEN RAISE EXCEPTION 'Initial revision required' USING ERRCODE='23514';END IF;RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "ClassAnnouncement_initial" AFTER INSERT ON "ClassAnnouncement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase10_class_initial();
CREATE FUNCTION phase10_class_event() RETURNS trigger AS $$
DECLARE a "ClassAnnouncement"%ROWTYPE;latest INTEGER;last_action TEXT;reviewer TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO a FROM "ClassAnnouncement" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."announcementId" FOR UPDATE;
 SELECT MAX("revision") INTO latest FROM "ClassAnnouncementRevision" WHERE "schoolId"=a."schoolId" AND "announcementId"=a."id";
 SELECT "action" INTO last_action FROM "ClassAnnouncementEvent" WHERE "schoolId"=a."schoolId" AND "announcementId"=a."id" AND "revision"=NEW."revision" AND "action"<>'WITHDRAW' ORDER BY "ordinal" DESC LIMIT 1;
 IF a."id" IS NULL THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 IF NEW."action"='WITHDRAW' THEN
  IF NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" e WHERE e."schoolId"=a."schoolId" AND e."announcementId"=a."id" AND e."revision"=NEW."revision" AND e."id"=NEW."targetReleaseId" AND e."action"='RELEASE') OR NOT ((a."authorUserId"=NEW."actorUserId" AND phase10_class_author(a)) OR phase10_owner(a."schoolId",NEW."actorUserId")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 ELSE
  IF NEW."revision"<>latest OR NOT phase10_class_author(a) THEN RAISE EXCEPTION 'Unavailable or stale' USING ERRCODE='23503';END IF;
  IF NEW."action"='SUBMIT' THEN
   IF last_action IS NOT NULL OR a."authorUserId"<>NEW."actorUserId" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  ELSIF NEW."action" IN ('APPROVE','RETURN') THEN
   IF last_action<>'SUBMIT' OR last_action IS NULL OR NOT phase10_class_reviewer(a,NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  ELSE
   SELECT "actorUserId" INTO reviewer FROM "ClassAnnouncementEvent" WHERE "schoolId"=a."schoolId" AND "announcementId"=a."id" AND "revision"=NEW."revision" AND "action"='APPROVE';
   IF last_action IS DISTINCT FROM 'APPROVE' OR a."authorUserId"<>NEW."actorUserId" OR NOT COALESCE(phase10_class_reviewer(a,reviewer),false) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  END IF;
 END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ClassAnnouncementEvent_validate" BEFORE INSERT ON "ClassAnnouncementEvent" FOR EACH ROW EXECUTE FUNCTION phase10_class_event();
CREATE FUNCTION can_read_class_announcement(s TEXT,r UUID,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" e JOIN "ClassAnnouncement" a ON a."schoolId"=e."schoolId" AND a."id"=e."announcementId"
 WHERE e."schoolId"=s AND e."id"=r AND e."action"='RELEASE' AND phase10_class_author(a)
 AND EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" approved WHERE approved."schoolId"=s AND approved."announcementId"=a."id" AND approved."revision"=e."revision" AND approved."action"='APPROVE' AND phase10_class_reviewer(a,approved."actorUserId"))
 AND NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" withdrawn WHERE withdrawn."schoolId"=s AND withdrawn."targetReleaseId"=r AND withdrawn."action"='WITHDRAW')
 AND NOT EXISTS(SELECT 1 FROM "ClassAnnouncementEvent" newer WHERE newer."schoolId"=s AND newer."announcementId"=a."id" AND newer."action"='RELEASE' AND newer."ordinal">e."ordinal")
 AND (u=a."authorUserId" OR phase10_class_reviewer(a,u) OR EXISTS(SELECT 1 FROM "Membership" m JOIN "StudentAccountLink" b ON b."schoolId"=s AND b."studentMembershipId"=m."id" JOIN "StudentRecord" p ON p."schoolId"=s AND p."id"=b."studentId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=s AND enrollment."studentId"=p."id" AND enrollment."classId"=a."classId" AND enrollment."sessionId"=a."sessionId" AND enrollment."status"='ACTIVE' WHERE m."schoolId"=s AND m."userId"=u AND m."role"='STUDENT' AND m."isActive" AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" v WHERE v."schoolId"=s AND v."linkId"=b."id"))));
$$ LANGUAGE sql STABLE;
CREATE TRIGGER "ClassAnnouncement_immutable" BEFORE UPDATE OR DELETE ON "ClassAnnouncement" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncement_no_truncate" BEFORE TRUNCATE ON "ClassAnnouncement" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncementRevision_immutable" BEFORE UPDATE OR DELETE ON "ClassAnnouncementRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncementRevision_no_truncate" BEFORE TRUNCATE ON "ClassAnnouncementRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncementEvent_immutable" BEFORE UPDATE OR DELETE ON "ClassAnnouncementEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "ClassAnnouncementEvent_no_truncate" BEFORE TRUNCATE ON "ClassAnnouncementEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

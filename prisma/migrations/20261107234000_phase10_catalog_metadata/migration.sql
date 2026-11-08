-- Catalog metadata is not a downloadable asset or a copyright authorization.
CREATE TABLE "LibraryCatalogEntry" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"curatorUserId" TEXT NOT NULL,"curatorMembershipId" TEXT NOT NULL,"kind" TEXT NOT NULL CHECK("kind" IN ('PHYSICAL_BOOK','DIGITAL_RESOURCE')),"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","curatorMembershipId") REFERENCES "Membership"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LibraryCatalogRevision" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"entryId" UUID NOT NULL,"revision" INTEGER NOT NULL CHECK("revision">0),"title" VARCHAR(160) NOT NULL CHECK(length(btrim("title")) BETWEEN 1 AND 160),"author" VARCHAR(160) NOT NULL CHECK(length(btrim("author")) BETWEEN 1 AND 160),"publisher" VARCHAR(160) NOT NULL CHECK(length(btrim("publisher")) BETWEEN 1 AND 160),"isbn" VARCHAR(32),"description" TEXT NOT NULL CHECK(length(btrim("description")) BETWEEN 1 AND 20000),"provenance" VARCHAR(1000) NOT NULL CHECK(length(btrim("provenance")) BETWEEN 5 AND 1000),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","entryId","revision"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","entryId") REFERENCES "LibraryCatalogEntry"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LibraryCatalogReview" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"entryId" UUID NOT NULL,"revision" INTEGER NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('APPROVE','RETURN')),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","entryId","revision"),UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","entryId","revision") REFERENCES "LibraryCatalogRevision"("schoolId","entryId","revision") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LibraryCatalogRelease" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"entryId" UUID NOT NULL,"revision" INTEGER NOT NULL,"scope" TEXT NOT NULL CHECK("scope" IN ('SCHOOL','SECTION','CLASS','STUDENT')),"sectionId" TEXT,"classId" TEXT,"studentId" TEXT,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),"ordinal" BIGINT GENERATED ALWAYS AS IDENTITY,
 CHECK(("scope"='SCHOOL' AND "sectionId" IS NULL AND "classId" IS NULL AND "studentId" IS NULL) OR ("scope"='SECTION' AND "sectionId" IS NOT NULL AND "classId" IS NULL AND "studentId" IS NULL) OR ("scope"='CLASS' AND "sectionId" IS NULL AND "classId" IS NOT NULL AND "studentId" IS NULL) OR ("scope"='STUDENT' AND "sectionId" IS NULL AND "classId" IS NULL AND "studentId" IS NOT NULL)),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),UNIQUE("schoolId","entryId","revision"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","entryId","revision") REFERENCES "LibraryCatalogRevision"("schoolId","entryId","revision") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","sectionId") REFERENCES "SchoolSection"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LibraryCatalogWithdrawal" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"releaseId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","releaseId"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","releaseId") REFERENCES "LibraryCatalogRelease"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "LibraryCatalogRelease_feed" ON "LibraryCatalogRelease"("schoolId","scope","ordinal" DESC);
CREATE FUNCTION phase10_catalog_curator(s TEXT,u TEXT,m TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "Membership" member JOIN "School" school ON school."id"=member."schoolId" AND school."isActive" WHERE member."schoolId"=s AND member."id"=m AND member."userId"=u AND member."isActive" AND member."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN','TEACHER','FORM_TEACHER'));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_catalog_create() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_catalog_curator(NEW."schoolId",NEW."curatorUserId",NEW."curatorMembershipId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LibraryCatalogEntry_validate" BEFORE INSERT ON "LibraryCatalogEntry" FOR EACH ROW EXECUTE FUNCTION phase10_catalog_create();
CREATE FUNCTION phase10_catalog_revision() RETURNS trigger AS $$
DECLARE c "LibraryCatalogEntry"%ROWTYPE;latest INTEGER;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO c FROM "LibraryCatalogEntry" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."entryId" FOR UPDATE;
 SELECT COALESCE(MAX("revision"),0) INTO latest FROM "LibraryCatalogRevision" WHERE "schoolId"=c."schoolId" AND "entryId"=c."id";
 IF c."id" IS NULL OR c."curatorUserId"<>NEW."actorUserId" OR NOT phase10_catalog_curator(c."schoolId",c."curatorUserId",c."curatorMembershipId") OR NEW."revision"<>latest+1 THEN RAISE EXCEPTION 'Unavailable or stale' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LibraryCatalogRevision_validate" BEFORE INSERT ON "LibraryCatalogRevision" FOR EACH ROW EXECUTE FUNCTION phase10_catalog_revision();
CREATE FUNCTION phase10_catalog_initial() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "LibraryCatalogRevision" WHERE "schoolId"=NEW."schoolId" AND "entryId"=NEW."id" AND "revision"=1) THEN RAISE EXCEPTION 'Initial catalog revision required' USING ERRCODE='23514';END IF;RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "LibraryCatalogEntry_initial" AFTER INSERT ON "LibraryCatalogEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase10_catalog_initial();
CREATE FUNCTION phase10_catalog_review() RETURNS trigger AS $$
DECLARE c "LibraryCatalogEntry"%ROWTYPE;latest INTEGER;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO c FROM "LibraryCatalogEntry" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."entryId" FOR UPDATE;
 SELECT MAX("revision") INTO latest FROM "LibraryCatalogRevision" WHERE "schoolId"=c."schoolId" AND "entryId"=c."id";
 IF c."id" IS NULL OR NEW."revision"<>latest OR c."curatorUserId"=NEW."actorUserId" OR NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR NOT phase10_catalog_curator(c."schoolId",c."curatorUserId",c."curatorMembershipId") THEN RAISE EXCEPTION 'Unavailable or unreviewed' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LibraryCatalogReview_validate" BEFORE INSERT ON "LibraryCatalogReview" FOR EACH ROW EXECUTE FUNCTION phase10_catalog_review();
CREATE FUNCTION phase10_catalog_release() RETURNS trigger AS $$
DECLARE c "LibraryCatalogEntry"%ROWTYPE;latest INTEGER;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO c FROM "LibraryCatalogEntry" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."entryId" FOR UPDATE;
 SELECT MAX("revision") INTO latest FROM "LibraryCatalogRevision" WHERE "schoolId"=c."schoolId" AND "entryId"=c."id";
 IF c."id" IS NULL OR NEW."revision"<>latest OR NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR NOT phase10_catalog_curator(c."schoolId",c."curatorUserId",c."curatorMembershipId") OR NOT EXISTS(SELECT 1 FROM "LibraryCatalogReview" r WHERE r."schoolId"=c."schoolId" AND r."entryId"=c."id" AND r."revision"=latest AND r."action"='APPROVE' AND phase10_owner(r."schoolId",r."actorUserId")) THEN RAISE EXCEPTION 'Unavailable or unreviewed' USING ERRCODE='23503';END IF;
 IF (NEW."sectionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "SchoolSection" WHERE "schoolId"=c."schoolId" AND "id"=NEW."sectionId" AND "isActive")) OR (NEW."classId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "SchoolClass" room JOIN "SchoolSection" section ON section."schoolId"=room."schoolId" AND section."id"=room."sectionId" AND section."isActive" WHERE room."schoolId"=c."schoolId" AND room."id"=NEW."classId" AND room."isActive")) OR (NEW."studentId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "StudentRecord" WHERE "schoolId"=c."schoolId" AND "id"=NEW."studentId" AND "status"='ENROLLED')) THEN RAISE EXCEPTION 'Unavailable target' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LibraryCatalogRelease_validate" BEFORE INSERT ON "LibraryCatalogRelease" FOR EACH ROW EXECUTE FUNCTION phase10_catalog_release();
CREATE FUNCTION phase10_catalog_withdraw() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LibraryCatalogWithdrawal_validate" BEFORE INSERT ON "LibraryCatalogWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_catalog_withdraw();
CREATE FUNCTION can_read_library_catalog(s TEXT,r UUID,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "LibraryCatalogRelease" release JOIN "LibraryCatalogEntry" c ON c."schoolId"=release."schoolId" AND c."id"=release."entryId"
 WHERE release."schoolId"=s AND release."id"=r AND phase10_catalog_curator(s,c."curatorUserId",c."curatorMembershipId")
 AND phase10_owner(s,release."actorUserId")
 AND EXISTS(SELECT 1 FROM "LibraryCatalogReview" review WHERE review."schoolId"=s AND review."entryId"=c."id" AND review."revision"=release."revision" AND review."action"='APPROVE' AND phase10_owner(s,review."actorUserId"))
 AND NOT EXISTS(SELECT 1 FROM "LibraryCatalogWithdrawal" w WHERE w."schoolId"=s AND w."releaseId"=release."id")
 AND NOT EXISTS(SELECT 1 FROM "LibraryCatalogRelease" newer WHERE newer."schoolId"=s AND newer."entryId"=c."id" AND newer."ordinal">release."ordinal")
 AND (phase10_recipient(s,u,'STAFF_ONLY') OR EXISTS(SELECT 1 FROM "Membership" m JOIN "StudentAccountLink" b ON b."schoolId"=s AND b."studentMembershipId"=m."id" JOIN "StudentRecord" p ON p."schoolId"=s AND p."id"=b."studentId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" e ON e."schoolId"=s AND e."studentId"=p."id" AND e."status"='ACTIVE' JOIN "AcademicSession" session ON session."schoolId"=s AND session."id"=e."sessionId" AND session."status"='ACTIVE' JOIN "SchoolClass" room ON room."schoolId"=s AND room."id"=e."classId" AND room."isActive" JOIN "SchoolSection" section ON section."schoolId"=s AND section."id"=room."sectionId" AND section."isActive" WHERE m."schoolId"=s AND m."userId"=u AND m."isActive" AND m."role"='STUDENT' AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" v WHERE v."schoolId"=s AND v."linkId"=b."id") AND (release."scope"='SCHOOL' OR release."sectionId"=section."id" OR release."classId"=room."id" OR release."studentId"=p."id"))));
$$ LANGUAGE sql STABLE;
CREATE TRIGGER "LibraryCatalogEntry_immutable" BEFORE UPDATE OR DELETE ON "LibraryCatalogEntry" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogEntry_no_truncate" BEFORE TRUNCATE ON "LibraryCatalogEntry" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogRevision_immutable" BEFORE UPDATE OR DELETE ON "LibraryCatalogRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogRevision_no_truncate" BEFORE TRUNCATE ON "LibraryCatalogRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogReview_immutable" BEFORE UPDATE OR DELETE ON "LibraryCatalogReview" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogReview_no_truncate" BEFORE TRUNCATE ON "LibraryCatalogReview" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogRelease_immutable" BEFORE UPDATE OR DELETE ON "LibraryCatalogRelease" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogRelease_no_truncate" BEFORE TRUNCATE ON "LibraryCatalogRelease" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogWithdrawal_immutable" BEFORE UPDATE OR DELETE ON "LibraryCatalogWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LibraryCatalogWithdrawal_no_truncate" BEFORE TRUNCATE ON "LibraryCatalogWithdrawal" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

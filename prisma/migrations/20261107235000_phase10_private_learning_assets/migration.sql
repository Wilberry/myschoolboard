-- Raster learning assets remain private; catalog approval grants no byte access.
CREATE TABLE "PrivateLearningAsset" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"entryId" UUID NOT NULL,"revision" INTEGER NOT NULL,"proposerUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"quarantineBlobId" UUID NOT NULL,"inputMime" TEXT NOT NULL CHECK("inputMime" IN ('image/png','image/jpeg')),"inputSha256" VARCHAR(64) NOT NULL CHECK("inputSha256"~'^[a-f0-9]{64}$'),"inputBytes" INTEGER NOT NULL CHECK("inputBytes" BETWEEN 1 AND 5242880),"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","entryId","revision") REFERENCES "LibraryCatalogRevision"("schoolId","entryId","revision") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningAssetInspection" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"assetId" UUID NOT NULL,"verdict" TEXT NOT NULL CHECK("verdict" IN ('PENDING','CLEAN','REJECTED','ERROR')),"profile" TEXT NOT NULL CHECK("profile"='RASTER_PNG_V1'),"blobId" UUID,"sha256" VARCHAR(64),"bytes" INTEGER,"width" INTEGER,"height" INTEGER,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(("verdict"='CLEAN' AND "blobId" IS NOT NULL AND "sha256" IS NOT NULL AND "bytes" IS NOT NULL AND "width" IS NOT NULL AND "height" IS NOT NULL AND "sha256"~'^[a-f0-9]{64}$' AND "bytes" BETWEEN 1 AND 10485760 AND "width" BETWEEN 1 AND 4096 AND "height" BETWEEN 1 AND 4096) OR ("verdict"<>'CLEAN' AND "blobId" IS NULL AND "sha256" IS NULL AND "bytes" IS NULL AND "width" IS NULL AND "height" IS NULL)),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","assetId","verdict"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","assetId") REFERENCES "PrivateLearningAsset"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX "LearningAssetInspection_terminal" ON "LearningAssetInspection"("schoolId","assetId") WHERE "verdict" IN ('CLEAN','REJECTED','ERROR');
CREATE TABLE "LearningAssetRights" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"assetId" UUID NOT NULL,"catalogReleaseId" UUID NOT NULL,"basis" TEXT NOT NULL CHECK("basis" IN ('OWNED','LICENSED','OPEN_LICENSE','PUBLIC_DOMAIN')),"sourceLicense" VARCHAR(1000) NOT NULL CHECK(length(btrim("sourceLicense")) BETWEEN 5 AND 1000),"permittedUse" TEXT NOT NULL CHECK("permittedUse"='EDUCATIONAL_VIEW_DOWNLOAD'),"expiresAt" TIMESTAMPTZ,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","assetId") REFERENCES "PrivateLearningAsset"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","catalogReleaseId") REFERENCES "LibraryCatalogRelease"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningAssetRelease" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"assetId" UUID NOT NULL,"rightsId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),UNIQUE("schoolId","assetId","rightsId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","assetId") REFERENCES "PrivateLearningAsset"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","rightsId") REFERENCES "LearningAssetRights"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningAssetWithdrawal" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"releaseId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","releaseId"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","releaseId") REFERENCES "LearningAssetRelease"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "PrivateLearningAsset_quota" ON "PrivateLearningAsset"("schoolId","proposerUserId","createdAt");
CREATE FUNCTION phase10_learning_asset_create() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "LibraryCatalogEntry" c JOIN "LibraryCatalogRevision" v ON v."schoolId"=c."schoolId" AND v."entryId"=c."id" AND v."revision"=NEW."revision" WHERE c."schoolId"=NEW."schoolId" AND c."id"=NEW."entryId" AND c."kind"='DIGITAL_RESOURCE' AND c."curatorUserId"=NEW."proposerUserId" AND phase10_catalog_curator(c."schoolId",c."curatorUserId",c."curatorMembershipId") AND NOT EXISTS(SELECT 1 FROM "LibraryCatalogRevision" newer WHERE newer."schoolId"=c."schoolId" AND newer."entryId"=c."id" AND newer."revision">v."revision")) THEN RAISE EXCEPTION 'Unavailable digital source' USING ERRCODE='23503';END IF;
 IF (SELECT count(*) FROM "PrivateLearningAsset" WHERE "schoolId"=NEW."schoolId" AND "proposerUserId"=NEW."proposerUserId" AND "createdAt">clock_timestamp()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'Learning asset quota reached' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PrivateLearningAsset_validate" BEFORE INSERT ON "PrivateLearningAsset" FOR EACH ROW EXECUTE FUNCTION phase10_learning_asset_create();
CREATE FUNCTION phase10_learning_inspection() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "PrivateLearningAsset" a JOIN "LibraryCatalogEntry" c ON c."schoolId"=a."schoolId" AND c."id"=a."entryId" WHERE a."schoolId"=NEW."schoolId" AND a."id"=NEW."assetId" AND phase10_catalog_curator(c."schoolId",c."curatorUserId",c."curatorMembershipId")) OR (NEW."verdict"<>'PENDING' AND NOT EXISTS(SELECT 1 FROM "LearningAssetInspection" i WHERE i."schoolId"=NEW."schoolId" AND i."assetId"=NEW."assetId" AND i."verdict"='PENDING')) THEN RAISE EXCEPTION 'Unavailable inspection source' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssetInspection_validate" BEFORE INSERT ON "LearningAssetInspection" FOR EACH ROW EXECUTE FUNCTION phase10_learning_inspection();
CREATE FUNCTION phase10_learning_rights() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR (NEW."expiresAt" IS NOT NULL AND NEW."expiresAt"<=clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM "PrivateLearningAsset" a JOIN "LibraryCatalogRelease" r ON r."schoolId"=a."schoolId" AND r."entryId"=a."entryId" AND r."revision"=a."revision" AND r."id"=NEW."catalogReleaseId" WHERE a."schoolId"=NEW."schoolId" AND a."id"=NEW."assetId" AND a."proposerUserId"<>NEW."actorUserId" AND can_read_library_catalog(a."schoolId",r."id",NEW."actorUserId")) THEN RAISE EXCEPTION 'Unavailable independent rights source' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssetRights_validate" BEFORE INSERT ON "LearningAssetRights" FOR EACH ROW EXECUTE FUNCTION phase10_learning_rights();
CREATE FUNCTION phase10_learning_asset_release() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR NOT EXISTS(SELECT 1 FROM "LearningAssetRights" rights JOIN "PrivateLearningAsset" a ON a."schoolId"=rights."schoolId" AND a."id"=rights."assetId" WHERE rights."schoolId"=NEW."schoolId" AND rights."id"=NEW."rightsId" AND a."id"=NEW."assetId" AND rights."actorUserId"<>a."proposerUserId" AND phase10_owner(rights."schoolId",rights."actorUserId") AND (rights."expiresAt" IS NULL OR rights."expiresAt">clock_timestamp()) AND can_read_library_catalog(rights."schoolId",rights."catalogReleaseId",NEW."actorUserId") AND EXISTS(SELECT 1 FROM "LearningAssetInspection" i WHERE i."schoolId"=a."schoolId" AND i."assetId"=a."id" AND i."verdict"='CLEAN')) THEN RAISE EXCEPTION 'Unavailable rights or inspection' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssetRelease_validate" BEFORE INSERT ON "LearningAssetRelease" FOR EACH ROW EXECUTE FUNCTION phase10_learning_asset_release();
CREATE FUNCTION phase10_learning_asset_withdraw() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssetWithdrawal_validate" BEFORE INSERT ON "LearningAssetWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_learning_asset_withdraw();
CREATE FUNCTION can_read_learning_asset(s TEXT,r UUID,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "LearningAssetRelease" release JOIN "LearningAssetRights" rights ON rights."schoolId"=release."schoolId" AND rights."id"=release."rightsId" JOIN "PrivateLearningAsset" a ON a."schoolId"=release."schoolId" AND a."id"=release."assetId" AND a."id"=rights."assetId" WHERE release."schoolId"=s AND release."id"=r AND phase10_owner(s,release."actorUserId") AND phase10_owner(s,rights."actorUserId") AND rights."actorUserId"<>a."proposerUserId" AND (rights."expiresAt" IS NULL OR rights."expiresAt">clock_timestamp()) AND can_read_library_catalog(s,rights."catalogReleaseId",u) AND EXISTS(SELECT 1 FROM "LearningAssetInspection" i WHERE i."schoolId"=s AND i."assetId"=a."id" AND i."verdict"='CLEAN') AND NOT EXISTS(SELECT 1 FROM "LearningAssetWithdrawal" w WHERE w."schoolId"=s AND w."releaseId"=r));
$$ LANGUAGE sql STABLE;
CREATE TRIGGER "PrivateLearningAsset_immutable" BEFORE UPDATE OR DELETE ON "PrivateLearningAsset" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "PrivateLearningAsset_no_truncate" BEFORE TRUNCATE ON "PrivateLearningAsset" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetInspection_immutable" BEFORE UPDATE OR DELETE ON "LearningAssetInspection" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetInspection_no_truncate" BEFORE TRUNCATE ON "LearningAssetInspection" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetRights_immutable" BEFORE UPDATE OR DELETE ON "LearningAssetRights" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetRights_no_truncate" BEFORE TRUNCATE ON "LearningAssetRights" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetRelease_immutable" BEFORE UPDATE OR DELETE ON "LearningAssetRelease" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetRelease_no_truncate" BEFORE TRUNCATE ON "LearningAssetRelease" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetWithdrawal_immutable" BEFORE UPDATE OR DELETE ON "LearningAssetWithdrawal" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssetWithdrawal_no_truncate" BEFORE TRUNCATE ON "LearningAssetWithdrawal" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

-- Forward-only integrity strengthening; never infer a historical author's role.
ALTER TABLE "Notice" ADD COLUMN "authorRole" TEXT CHECK("authorRole" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN'));
CREATE OR REPLACE FUNCTION phase10_notice_create() RETURNS trigger AS $$
DECLARE member TEXT; role TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT m."id",m."role"::text INTO member,role FROM "Membership" m JOIN "School" s ON s."id"=m."schoolId" AND s."isActive" WHERE m."schoolId"=NEW."schoolId" AND m."userId"=NEW."authorUserId" AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN');
 IF member IS NULL THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."authorMembershipId":=member;NEW."authorRole":=role;NEW."currentRevision":=0;NEW."state":='DRAFT';NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE FUNCTION phase10_independent_review() RETURNS trigger AS $$
BEGIN
 IF NEW."action" IN ('APPROVE','RETURN') AND EXISTS(SELECT 1 FROM "Notice" n WHERE n."schoolId"=NEW."schoolId" AND n."id"=NEW."noticeId" AND n."authorUserId"=NEW."actorUserId" AND n."authorRole" IS DISTINCT FROM 'SCHOOL_SUPER_ADMIN') THEN RAISE EXCEPTION 'Independent review required' USING ERRCODE='23503';END IF;RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeWorkflowEvent_independent_review" BEFORE INSERT ON "NoticeWorkflowEvent" FOR EACH ROW EXECUTE FUNCTION phase10_independent_review();
CREATE FUNCTION phase10_publication_context() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "NoticePolicyRevision" p WHERE p."schoolId"=NEW."schoolId" AND p."id"=NEW."policyId" AND p."version"=(SELECT max("version") FROM "NoticePolicyRevision" WHERE "schoolId"=NEW."schoolId")) OR NOT EXISTS(SELECT 1 FROM "Notice" n JOIN "Membership" m ON m."schoolId"=n."schoolId" AND m."id"=n."authorMembershipId" AND m."userId"=n."authorUserId" AND m."isActive" AND m."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN') WHERE n."schoolId"=NEW."schoolId" AND n."id"=NEW."noticeId") OR NOT EXISTS(SELECT 1 FROM "NoticeWorkflowEvent" e WHERE e."schoolId"=NEW."schoolId" AND e."noticeId"=NEW."noticeId" AND e."revision"=NEW."revision" AND e."action"='APPROVE' AND phase10_owner(e."schoolId",e."actorUserId")) THEN RAISE EXCEPTION 'Current publication context required' USING ERRCODE='23503';END IF;RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "NoticeRelease_current_context" BEFORE INSERT ON "NoticeRelease" FOR EACH ROW EXECUTE FUNCTION phase10_publication_context();
CREATE INDEX "Notice_author_worklist" ON "Notice"("schoolId","authorMembershipId","createdAt" DESC,"id");
CREATE INDEX "NoticeRelease_feed" ON "NoticeRelease"("schoolId","createdAt" DESC,"id");
CREATE INDEX "NotificationInteraction_latest" ON "NotificationInteraction"("schoolId","deliveryId","ordinal" DESC);

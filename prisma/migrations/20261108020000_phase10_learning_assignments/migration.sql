-- School-owned policy is explicit and versioned; no automatic submissions or Form tasks.
CREATE TABLE "LearningAssignmentPolicy" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"version" INTEGER NOT NULL,"timeZone" VARCHAR(64) NOT NULL,
 "allowFormTasks" BOOLEAN NOT NULL DEFAULT false,"allowTextSubmissions" BOOLEAN NOT NULL DEFAULT false,"allowImageReferences" BOOLEAN NOT NULL DEFAULT false,"allowLateSubmissions" BOOLEAN NOT NULL DEFAULT false,"allowResubmission" BOOLEAN NOT NULL DEFAULT false,
 "actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK((NOT "allowImageReferences" AND NOT "allowLateSubmissions" AND NOT "allowResubmission") OR "allowTextSubmissions"),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","version"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
CREATE FUNCTION phase10_task_policy() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT phase10_owner(NEW."schoolId",NEW."actorUserId") OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW."timeZone") THEN RAISE EXCEPTION 'Unavailable policy' USING ERRCODE='23503';END IF;
 SELECT COALESCE(MAX("version"),0)+1 INTO NEW."version" FROM "LearningAssignmentPolicy" WHERE "schoolId"=NEW."schoolId";NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssignmentPolicy_validate" BEFORE INSERT ON "LearningAssignmentPolicy" FOR EACH ROW EXECUTE FUNCTION phase10_task_policy();
-- Separate learning work; not a staff assignment, lesson, CBT or announcement.
CREATE TABLE "LearningAssignment" (
 "policyId" UUID NOT NULL,"id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"authorUserId" TEXT NOT NULL,"authorMembershipId" TEXT NOT NULL,
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
 FOREIGN KEY("schoolId","formResponsibilityId") REFERENCES "FormTeacherResponsibility"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","policyId") REFERENCES "LearningAssignmentPolicy"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningAssignmentRevision" (
 "dueAt" TIMESTAMPTZ NOT NULL,"submissionsEnabled" BOOLEAN NOT NULL DEFAULT false,"imageReferencesEnabled" BOOLEAN NOT NULL DEFAULT false,CHECK(NOT "imageReferencesEnabled" OR "submissionsEnabled"),"id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"taskId" UUID NOT NULL,"revision" INTEGER NOT NULL CHECK("revision">0),"title" VARCHAR(160) NOT NULL CHECK(length(btrim("title")) BETWEEN 1 AND 160),"body" TEXT NOT NULL CHECK(length(btrim("body")) BETWEEN 1 AND 20000),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","taskId","revision"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","taskId") REFERENCES "LearningAssignment"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningAssignmentEvent" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"taskId" UUID NOT NULL,"revision" INTEGER NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('SUBMIT','APPROVE','RETURN','RELEASE','WITHDRAW')),"targetReleaseId" UUID,
 "actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),"ordinal" BIGINT GENERATED ALWAYS AS IDENTITY,
 CHECK(("action"='WITHDRAW')=("targetReleaseId" IS NOT NULL)),
 UNIQUE("schoolId","id"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","taskId","revision") REFERENCES "LearningAssignmentRevision"("schoolId","taskId","revision") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","targetReleaseId") REFERENCES "LearningAssignmentEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX "LearningAssignmentEvent_submit_once" ON "LearningAssignmentEvent"("schoolId","taskId","revision") WHERE "action"='SUBMIT';
CREATE UNIQUE INDEX "LearningAssignmentEvent_review_once" ON "LearningAssignmentEvent"("schoolId","taskId","revision") WHERE "action" IN ('APPROVE','RETURN');
CREATE UNIQUE INDEX "LearningAssignmentEvent_release_once" ON "LearningAssignmentEvent"("schoolId","taskId","revision") WHERE "action"='RELEASE';
CREATE UNIQUE INDEX "LearningAssignmentEvent_withdraw_once" ON "LearningAssignmentEvent"("schoolId","targetReleaseId") WHERE "action"='WITHDRAW';
CREATE INDEX "LearningAssignment_scope" ON "LearningAssignment"("schoolId","classId","sessionId","termId");
CREATE INDEX "LearningAssignmentEvent_feed" ON "LearningAssignmentEvent"("schoolId","action","ordinal" DESC);
CREATE FUNCTION phase10_task_author(p "LearningAssignment") RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "School" s JOIN "Membership" m ON m."schoolId"=s."id" AND m."id"=p."authorMembershipId" AND m."userId"=p."authorUserId" AND m."isActive" AND m."role" IN ('TEACHER','FORM_TEACHER')
 JOIN "SchoolClass" c ON c."schoolId"=s."id" AND c."id"=p."classId" AND c."isActive"
 JOIN "SchoolSection" section ON section."schoolId"=s."id" AND section."id"=c."sectionId" AND section."isActive"
 JOIN "AcademicSession" session ON session."schoolId"=s."id" AND session."id"=p."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=s."id" AND term."id"=p."termId" AND term."sessionId"=session."id" AND term."status"='ACTIVE'
 WHERE s."id"=p."schoolId" AND s."isActive" AND EXISTS(SELECT 1 FROM "LearningAssignmentPolicy" policy WHERE policy."schoolId"=s."id" AND policy."id"=p."policyId" AND phase10_owner(s."id",policy."actorUserId")) AND ((p."assignmentId" IS NOT NULL AND EXISTS(SELECT 1 FROM "TeacherClassSubjectAssignment" a JOIN "Subject" subject ON subject."schoolId"=a."schoolId" AND subject."id"=a."subjectId" AND subject."isActive" WHERE a."schoolId"=s."id" AND a."id"=p."assignmentId" AND a."membershipId"=m."id" AND a."classId"=c."id" AND a."sessionId"=session."id" AND a."subjectId"=p."subjectId" AND a."status"='ACTIVE')) OR (p."formResponsibilityId" IS NOT NULL AND EXISTS(SELECT 1 FROM "LearningAssignmentPolicy" policy WHERE policy."schoolId"=s."id" AND policy."id"=p."policyId" AND policy."allowFormTasks") AND EXISTS(SELECT 1 FROM "FormTeacherResponsibility" a WHERE a."schoolId"=s."id" AND a."id"=p."formResponsibilityId" AND a."membershipId"=m."id" AND a."classId"=c."id" AND a."sessionId"=session."id" AND a."status"='ACTIVE'))));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_task_reviewer(p "LearningAssignment",u TEXT) RETURNS BOOLEAN AS $$
 SELECT p."authorUserId"<>u AND phase10_task_author(p) AND EXISTS(SELECT 1 FROM "Membership" m JOIN "SchoolClass" c ON c."schoolId"=m."schoolId" AND c."id"=p."classId" AND c."isActive" JOIN "SchoolSection" section ON section."schoolId"=c."schoolId" AND section."id"=c."sectionId" AND section."isActive" JOIN "ScopeGrant" g ON g."membershipId"=m."id" AND g."type"='SECTION' AND g."verified" AND g."scopeId"=section."id" WHERE m."schoolId"=p."schoolId" AND m."userId"=u AND m."isActive" AND ((m."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY') OR (m."role"='PRINCIPAL' AND section."stage"='SECONDARY')));
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_task_create() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NEW."policyId" IS DISTINCT FROM (SELECT "id" FROM "LearningAssignmentPolicy" WHERE "schoolId"=NEW."schoolId" ORDER BY "version" DESC LIMIT 1) OR NOT phase10_task_author(NEW) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssignment_create" BEFORE INSERT ON "LearningAssignment" FOR EACH ROW EXECUTE FUNCTION phase10_task_create();
CREATE FUNCTION phase10_task_revision() RETURNS trigger AS $$
DECLARE a "LearningAssignment"%ROWTYPE;latest INTEGER;last_action TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO a FROM "LearningAssignment" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."taskId" FOR UPDATE;
 SELECT COALESCE(MAX("revision"),0) INTO latest FROM "LearningAssignmentRevision" WHERE "schoolId"=a."schoolId" AND "taskId"=a."id";
 SELECT "action" INTO last_action FROM "LearningAssignmentEvent" WHERE "schoolId"=a."schoolId" AND "taskId"=a."id" AND "revision"=latest AND "action"<>'WITHDRAW' ORDER BY "ordinal" DESC LIMIT 1;
 IF a."id" IS NULL OR a."authorUserId"<>NEW."actorUserId" OR NOT phase10_task_author(a) OR NEW."revision"<>latest+1 OR last_action='SUBMIT' THEN RAISE EXCEPTION 'Unavailable or stale' USING ERRCODE='23503';END IF;
 IF NOT EXISTS(SELECT 1 FROM "LearningAssignmentPolicy" policy JOIN "AcademicTerm" term ON term."schoolId"=policy."schoolId" AND term."id"=a."termId" WHERE policy."schoolId"=a."schoolId" AND policy."id"=a."policyId" AND NEW."dueAt">clock_timestamp() AND (NEW."dueAt" AT TIME ZONE policy."timeZone")::date BETWEEN term."startsOn" AND term."endsOn" AND (NOT NEW."submissionsEnabled" OR policy."allowTextSubmissions") AND (NOT NEW."imageReferencesEnabled" OR policy."allowImageReferences")) THEN RAISE EXCEPTION 'Unavailable due/submission policy' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssignmentRevision_validate" BEFORE INSERT ON "LearningAssignmentRevision" FOR EACH ROW EXECUTE FUNCTION phase10_task_revision();
CREATE FUNCTION phase10_task_initial() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "LearningAssignmentRevision" WHERE "schoolId"=NEW."schoolId" AND "taskId"=NEW."id" AND "revision"=1) THEN RAISE EXCEPTION 'Initial revision required' USING ERRCODE='23514';END IF;RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "LearningAssignment_initial" AFTER INSERT ON "LearningAssignment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase10_task_initial();
CREATE FUNCTION phase10_task_event() RETURNS trigger AS $$
DECLARE a "LearningAssignment"%ROWTYPE;latest INTEGER;last_action TEXT;reviewer TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO a FROM "LearningAssignment" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."taskId" FOR UPDATE;
 SELECT MAX("revision") INTO latest FROM "LearningAssignmentRevision" WHERE "schoolId"=a."schoolId" AND "taskId"=a."id";
 SELECT "action" INTO last_action FROM "LearningAssignmentEvent" WHERE "schoolId"=a."schoolId" AND "taskId"=a."id" AND "revision"=NEW."revision" AND "action"<>'WITHDRAW' ORDER BY "ordinal" DESC LIMIT 1;
 IF a."id" IS NULL THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 IF NEW."action"='WITHDRAW' THEN
  IF NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" e WHERE e."schoolId"=a."schoolId" AND e."taskId"=a."id" AND e."revision"=NEW."revision" AND e."id"=NEW."targetReleaseId" AND e."action"='RELEASE') OR NOT ((a."authorUserId"=NEW."actorUserId" AND phase10_task_author(a)) OR phase10_owner(a."schoolId",NEW."actorUserId")) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
 ELSE
  IF NEW."revision"<>latest OR NOT phase10_task_author(a) THEN RAISE EXCEPTION 'Unavailable or stale' USING ERRCODE='23503';END IF;
  IF NEW."action"='SUBMIT' THEN
   IF last_action IS NOT NULL OR a."authorUserId"<>NEW."actorUserId" THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  ELSIF NEW."action" IN ('APPROVE','RETURN') THEN
   IF last_action<>'SUBMIT' OR last_action IS NULL OR NOT phase10_task_reviewer(a,NEW."actorUserId") THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  ELSE
   SELECT "actorUserId" INTO reviewer FROM "LearningAssignmentEvent" WHERE "schoolId"=a."schoolId" AND "taskId"=a."id" AND "revision"=NEW."revision" AND "action"='APPROVE';
   IF NOT EXISTS(SELECT 1 FROM "LearningAssignmentRevision" v WHERE v."schoolId"=a."schoolId" AND v."taskId"=a."id" AND v."revision"=NEW."revision" AND v."dueAt">clock_timestamp()) OR a."policyId" IS DISTINCT FROM(SELECT "id" FROM "LearningAssignmentPolicy" WHERE "schoolId"=a."schoolId" ORDER BY "version" DESC LIMIT 1) OR last_action IS DISTINCT FROM 'APPROVE' OR a."authorUserId"<>NEW."actorUserId" OR NOT COALESCE(phase10_task_reviewer(a,reviewer),false) THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='23503';END IF;
  END IF;
 END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssignmentEvent_validate" BEFORE INSERT ON "LearningAssignmentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_task_event();
CREATE FUNCTION can_read_learning_assignment(s TEXT,r UUID,u TEXT) RETURNS BOOLEAN AS $$
 SELECT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" e JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId"
 WHERE e."schoolId"=s AND e."id"=r AND e."action"='RELEASE' AND phase10_task_author(a)
 AND EXISTS(SELECT 1 FROM "LearningAssignmentEvent" approved WHERE approved."schoolId"=s AND approved."taskId"=a."id" AND approved."revision"=e."revision" AND approved."action"='APPROVE' AND phase10_task_reviewer(a,approved."actorUserId"))
 AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" withdrawn WHERE withdrawn."schoolId"=s AND withdrawn."targetReleaseId"=r AND withdrawn."action"='WITHDRAW')
 AND NOT EXISTS(SELECT 1 FROM "LearningAssignmentEvent" newer WHERE newer."schoolId"=s AND newer."taskId"=a."id" AND newer."action"='RELEASE' AND newer."ordinal">e."ordinal")
 AND (u=a."authorUserId" OR phase10_task_reviewer(a,u) OR EXISTS(SELECT 1 FROM "Membership" m JOIN "StudentAccountLink" b ON b."schoolId"=s AND b."studentMembershipId"=m."id" JOIN "StudentRecord" p ON p."schoolId"=s AND p."id"=b."studentId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=s AND enrollment."studentId"=p."id" AND enrollment."classId"=a."classId" AND enrollment."sessionId"=a."sessionId" AND enrollment."status"='ACTIVE' WHERE m."schoolId"=s AND m."userId"=u AND m."role"='STUDENT' AND m."isActive" AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" v WHERE v."schoolId"=s AND v."linkId"=b."id"))));
$$ LANGUAGE sql STABLE;
CREATE TRIGGER "LearningAssignment_immutable" BEFORE UPDATE OR DELETE ON "LearningAssignment" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignment_no_truncate" BEFORE TRUNCATE ON "LearningAssignment" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentRevision_immutable" BEFORE UPDATE OR DELETE ON "LearningAssignmentRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentRevision_no_truncate" BEFORE TRUNCATE ON "LearningAssignmentRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentEvent_immutable" BEFORE UPDATE OR DELETE ON "LearningAssignmentEvent" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentEvent_no_truncate" BEFORE TRUNCATE ON "LearningAssignmentEvent" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TABLE "LearningAssignmentResource" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"taskId" UUID NOT NULL,"revision" INTEGER NOT NULL,"assetReleaseId" UUID NOT NULL,"actorUserId" TEXT NOT NULL,
 UNIQUE("schoolId","taskId","revision","assetReleaseId"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","taskId","revision") REFERENCES "LearningAssignmentRevision"("schoolId","taskId","revision") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","assetReleaseId") REFERENCES "LearningAssetRelease"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION phase10_task_resource() RETURNS trigger AS $$
DECLARE a "LearningAssignment"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT * INTO a FROM "LearningAssignment" WHERE "schoolId"=NEW."schoolId" AND "id"=NEW."taskId" FOR UPDATE;
 IF a."id" IS NULL OR a."authorUserId"<>NEW."actorUserId" OR NOT phase10_task_author(a) OR NOT can_read_learning_asset(NEW."schoolId",NEW."assetReleaseId",NEW."actorUserId") OR EXISTS(SELECT 1 FROM "LearningAssignmentEvent" e WHERE e."schoolId"=NEW."schoolId" AND e."taskId"=NEW."taskId" AND e."revision"=NEW."revision") OR (SELECT count(*) FROM "LearningAssignmentResource" WHERE "schoolId"=NEW."schoolId" AND "taskId"=NEW."taskId" AND "revision"=NEW."revision")>=3 THEN RAISE EXCEPTION 'Unavailable attachment context' USING ERRCODE='23503';END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningAssignmentResource_validate" BEFORE INSERT ON "LearningAssignmentResource" FOR EACH ROW EXECUTE FUNCTION phase10_task_resource();
CREATE TABLE "LearningSubmissionRevision" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"releaseId" UUID NOT NULL,"studentId" TEXT NOT NULL,"enrollmentId" TEXT NOT NULL,"revision" INTEGER NOT NULL CHECK("revision" BETWEEN 1 AND 20),"text" TEXT NOT NULL CHECK(length(btrim("text")) BETWEEN 1 AND 20000),"assetReleaseIds" UUID[] NOT NULL DEFAULT '{}',"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(cardinality("assetReleaseIds")<=3),UNIQUE("schoolId","id"),UNIQUE("schoolId","releaseId","studentId","revision"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","releaseId") REFERENCES "LearningAssignmentEvent"("schoolId","id") DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY("schoolId","enrollmentId","studentId") REFERENCES "StudentEnrollment"("schoolId","id","studentId") DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE "LearningSubmissionReview" (
 "id" UUID PRIMARY KEY,"schoolId" TEXT NOT NULL,"submissionId" UUID NOT NULL,"action" TEXT NOT NULL CHECK("action" IN ('APPROVE','RETURN')),"actorUserId" TEXT NOT NULL,"requestKey" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL CHECK(length(btrim("reason")) BETWEEN 5 AND 500),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE("schoolId","submissionId"),UNIQUE("schoolId","requestKey"),FOREIGN KEY("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
 FOREIGN KEY("schoolId","submissionId") REFERENCES "LearningSubmissionRevision"("schoolId","id") DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX "LearningSubmissionRevision_own" ON "LearningSubmissionRevision"("schoolId","releaseId","studentId","revision" DESC);
CREATE FUNCTION phase10_task_pupil(s TEXT,r UUID,u TEXT) RETURNS TABLE("studentId" TEXT,"enrollmentId" TEXT) AS $$
 SELECT p."id",enrollment."id" FROM "LearningAssignmentEvent" e JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN "Membership" m ON m."schoolId"=a."schoolId" AND m."userId"=u AND m."role"='STUDENT' AND m."isActive" JOIN "StudentAccountLink" b ON b."schoolId"=a."schoolId" AND b."studentMembershipId"=m."id" JOIN "StudentRecord" p ON p."schoolId"=a."schoolId" AND p."id"=b."studentId" AND p."status"='ENROLLED' JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=a."schoolId" AND enrollment."studentId"=p."id" AND enrollment."classId"=a."classId" AND enrollment."sessionId"=a."sessionId" AND enrollment."status"='ACTIVE' WHERE e."schoolId"=s AND e."id"=r AND can_read_learning_assignment(s,r,u) AND NOT EXISTS(SELECT 1 FROM "StudentAccountLinkRevocation" revoked WHERE revoked."schoolId"=s AND revoked."linkId"=b."id");
$$ LANGUAGE sql STABLE;
CREATE FUNCTION phase10_task_submission() RETURNS trigger AS $$
DECLARE a "LearningAssignment"%ROWTYPE;v "LearningAssignmentRevision"%ROWTYPE;p "LearningAssignmentPolicy"%ROWTYPE;latest INTEGER;review TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT task.* INTO a FROM "LearningAssignment" task JOIN "LearningAssignmentEvent" e ON e."schoolId"=task."schoolId" AND e."taskId"=task."id" AND e."action"='RELEASE' WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."releaseId";
 SELECT rev.* INTO v FROM "LearningAssignmentRevision" rev JOIN "LearningAssignmentEvent" e ON e."schoolId"=rev."schoolId" AND e."taskId"=rev."taskId" AND e."revision"=rev."revision" WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."releaseId";
 SELECT * INTO p FROM "LearningAssignmentPolicy" WHERE "schoolId"=a."schoolId" AND "id"=a."policyId";
 SELECT COALESCE(MAX("revision"),0) INTO latest FROM "LearningSubmissionRevision" WHERE "schoolId"=NEW."schoolId" AND "releaseId"=NEW."releaseId" AND "studentId"=NEW."studentId";
 SELECT r."action" INTO review FROM "LearningSubmissionReview" r JOIN "LearningSubmissionRevision" submitted ON submitted."schoolId"=r."schoolId" AND submitted."id"=r."submissionId" WHERE submitted."schoolId"=NEW."schoolId" AND submitted."releaseId"=NEW."releaseId" AND submitted."studentId"=NEW."studentId" AND submitted."revision"=latest;
 IF a."id" IS NULL OR NOT v."submissionsEnabled" OR NOT p."allowTextSubmissions" OR NEW."revision"<>latest+1 OR (latest>0 AND (NOT p."allowResubmission" OR review IS DISTINCT FROM 'RETURN')) OR (v."dueAt"<clock_timestamp() AND NOT p."allowLateSubmissions") OR NOT EXISTS(SELECT 1 FROM phase10_task_pupil(NEW."schoolId",NEW."releaseId",NEW."actorUserId") child WHERE child."studentId"=NEW."studentId" AND child."enrollmentId"=NEW."enrollmentId") OR (cardinality(NEW."assetReleaseIds")>0 AND (NOT v."imageReferencesEnabled" OR NOT p."allowImageReferences")) OR cardinality(NEW."assetReleaseIds")<>(SELECT count(DISTINCT id) FROM unnest(NEW."assetReleaseIds") id) OR EXISTS(SELECT 1 FROM unnest(NEW."assetReleaseIds") id WHERE NOT can_read_learning_asset(NEW."schoolId",id,NEW."actorUserId") OR NOT EXISTS(SELECT 1 FROM "LearningAssignmentResource" ref WHERE ref."schoolId"=a."schoolId" AND ref."taskId"=a."id" AND ref."revision"=v."revision" AND ref."assetReleaseId"=id)) THEN RAISE EXCEPTION 'Unavailable submission policy or identity' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningSubmissionRevision_validate" BEFORE INSERT ON "LearningSubmissionRevision" FOR EACH ROW EXECUTE FUNCTION phase10_task_submission();
CREATE FUNCTION phase10_task_submission_review() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "LearningSubmissionRevision" submitted JOIN "LearningAssignmentEvent" e ON e."schoolId"=submitted."schoolId" AND e."id"=submitted."releaseId" JOIN "LearningAssignment" a ON a."schoolId"=e."schoolId" AND a."id"=e."taskId" JOIN LATERAL phase10_task_pupil(submitted."schoolId",submitted."releaseId",submitted."actorUserId") child ON child."studentId"=submitted."studentId" AND child."enrollmentId"=submitted."enrollmentId" WHERE submitted."schoolId"=NEW."schoolId" AND submitted."id"=NEW."submissionId" AND a."authorUserId"=NEW."actorUserId" AND phase10_task_author(a) AND NOT EXISTS(SELECT 1 FROM "LearningSubmissionRevision" newer WHERE newer."schoolId"=submitted."schoolId" AND newer."releaseId"=submitted."releaseId" AND newer."studentId"=submitted."studentId" AND newer."revision">submitted."revision")) THEN RAISE EXCEPTION 'Unavailable exact teacher review' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LearningSubmissionReview_validate" BEFORE INSERT ON "LearningSubmissionReview" FOR EACH ROW EXECUTE FUNCTION phase10_task_submission_review();
CREATE TRIGGER "LearningAssignmentPolicy_immutable" BEFORE UPDATE OR DELETE ON "LearningAssignmentPolicy" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentPolicy_no_truncate" BEFORE TRUNCATE ON "LearningAssignmentPolicy" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentResource_immutable" BEFORE UPDATE OR DELETE ON "LearningAssignmentResource" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningAssignmentResource_no_truncate" BEFORE TRUNCATE ON "LearningAssignmentResource" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningSubmissionRevision_immutable" BEFORE UPDATE OR DELETE ON "LearningSubmissionRevision" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningSubmissionRevision_no_truncate" BEFORE TRUNCATE ON "LearningSubmissionRevision" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningSubmissionReview_immutable" BEFORE UPDATE OR DELETE ON "LearningSubmissionReview" FOR EACH ROW EXECUTE FUNCTION phase10_immutable();
CREATE TRIGGER "LearningSubmissionReview_no_truncate" BEFORE TRUNCATE ON "LearningSubmissionReview" FOR EACH STATEMENT EXECUTE FUNCTION phase10_immutable();

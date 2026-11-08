-- Qualify the requested image identity in the nested resource intersection.
-- Preserve the applied assignment migration and all immutable submission history.
CREATE OR REPLACE FUNCTION phase10_task_submission() RETURNS trigger AS $$
DECLARE a "LearningAssignment"%ROWTYPE;v "LearningAssignmentRevision"%ROWTYPE;p "LearningAssignmentPolicy"%ROWTYPE;latest INTEGER;review TEXT;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" FOR UPDATE;
 SELECT task.* INTO a FROM "LearningAssignment" task JOIN "LearningAssignmentEvent" e ON e."schoolId"=task."schoolId" AND e."taskId"=task."id" AND e."action"='RELEASE' WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."releaseId";
 SELECT rev.* INTO v FROM "LearningAssignmentRevision" rev JOIN "LearningAssignmentEvent" e ON e."schoolId"=rev."schoolId" AND e."taskId"=rev."taskId" AND e."revision"=rev."revision" WHERE e."schoolId"=NEW."schoolId" AND e."id"=NEW."releaseId";
 SELECT * INTO p FROM "LearningAssignmentPolicy" WHERE "schoolId"=a."schoolId" AND "id"=a."policyId";
 SELECT COALESCE(MAX("revision"),0) INTO latest FROM "LearningSubmissionRevision" WHERE "schoolId"=NEW."schoolId" AND "releaseId"=NEW."releaseId" AND "studentId"=NEW."studentId";
 SELECT r."action" INTO review FROM "LearningSubmissionReview" r JOIN "LearningSubmissionRevision" submitted ON submitted."schoolId"=r."schoolId" AND submitted."id"=r."submissionId" WHERE submitted."schoolId"=NEW."schoolId" AND submitted."releaseId"=NEW."releaseId" AND submitted."studentId"=NEW."studentId" AND submitted."revision"=latest;
 IF a."id" IS NULL OR NOT v."submissionsEnabled" OR NOT p."allowTextSubmissions" OR NEW."revision"<>latest+1 OR (latest>0 AND (NOT p."allowResubmission" OR review IS DISTINCT FROM 'RETURN')) OR (v."dueAt"<clock_timestamp() AND NOT p."allowLateSubmissions") OR NOT EXISTS(SELECT 1 FROM phase10_task_pupil(NEW."schoolId",NEW."releaseId",NEW."actorUserId") child WHERE child."studentId"=NEW."studentId" AND child."enrollmentId"=NEW."enrollmentId") OR (cardinality(NEW."assetReleaseIds")>0 AND (NOT v."imageReferencesEnabled" OR NOT p."allowImageReferences")) OR cardinality(NEW."assetReleaseIds")<>(SELECT count(DISTINCT id) FROM unnest(NEW."assetReleaseIds") id) OR EXISTS(SELECT 1 FROM unnest(NEW."assetReleaseIds") AS wanted("assetReleaseId") WHERE NOT can_read_learning_asset(NEW."schoolId",wanted."assetReleaseId",NEW."actorUserId") OR NOT EXISTS(SELECT 1 FROM "LearningAssignmentResource" ref WHERE ref."schoolId"=a."schoolId" AND ref."taskId"=a."id" AND ref."revision"=v."revision" AND ref."assetReleaseId"=wanted."assetReleaseId")) THEN RAISE EXCEPTION 'Unavailable submission policy or identity' USING ERRCODE='23503';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END;
$$ LANGUAGE plpgsql;

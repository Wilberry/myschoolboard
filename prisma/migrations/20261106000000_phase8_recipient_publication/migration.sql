-- A distinct immutable recipient release. Academic approval and private
-- composition never imply publication. Visibility is explicitly selected.
CREATE TABLE "ReportPublication" (
 "id" TEXT PRIMARY KEY,
 "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
 "compositionId" TEXT NOT NULL,
 "visibility" VARCHAR(32) NOT NULL CHECK ("visibility" IN
   ('ASSESSMENT_ONLY','PARENT_ONLY','PARENT_FIRST','PARENT_AND_STUDENT')),
 "reason" VARCHAR(500) NOT NULL CHECK (length(btrim("reason")) BETWEEN 5 AND 500),
 "actorMembershipId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","id"), UNIQUE ("schoolId","compositionId"),
 FOREIGN KEY ("schoolId","compositionId") REFERENCES "PrivateOfficialReportComposition"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);
CREATE TABLE "ReportPublicationWithdrawal" (
 "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE, "publicationId" TEXT NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "reason" VARCHAR(500) NOT NULL CHECK (length(btrim("reason")) BETWEEN 5 AND 500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","publicationId"),
 FOREIGN KEY ("schoolId","publicationId") REFERENCES "ReportPublication"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);
CREATE TABLE "ReportGuardianAcknowledgment" (
 "id" TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE, "publicationId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL, "guardianLinkId" TEXT NOT NULL,
 "actorMembershipId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("schoolId","publicationId","studentId","guardianLinkId"),
 FOREIGN KEY ("schoolId","publicationId") REFERENCES "ReportPublication"("schoolId","id"),
 FOREIGN KEY ("schoolId","studentId") REFERENCES "StudentRecord"("schoolId","id"),
 FOREIGN KEY ("schoolId","guardianLinkId") REFERENCES "GuardianStudentLink"("schoolId","id"),
 FOREIGN KEY ("schoolId","actorMembershipId") REFERENCES "Membership"("schoolId","id")
);

CREATE FUNCTION "validate_report_publication"() RETURNS trigger AS $$
DECLARE composition RECORD;
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive" FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM "Membership" m
   WHERE m."schoolId"=NEW."schoolId" AND m."id"=NEW."actorMembershipId"
     AND m."userId"=NEW."actorUserId" AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive") THEN
   RAISE EXCEPTION 'Current school owner required' USING ERRCODE='23503';
 END IF;
 IF TG_TABLE_NAME='ReportPublication' THEN
   SELECT * INTO composition FROM "PrivateOfficialReportComposition" c
    WHERE c."schoolId"=NEW."schoolId" AND c."id"=NEW."compositionId";
   IF NOT FOUND THEN RAISE EXCEPTION 'Composition required' USING ERRCODE='23503'; END IF;
   PERFORM "assert_result_publication_readiness"(NEW."schoolId",composition."evidenceId",NEW."actorMembershipId",NEW."actorUserId");
   IF composition."aggregationRuleVersion" IS DISTINCT FROM (SELECT max("version") FROM "ReportAggregationRuleRevision" WHERE "schoolId"=NEW."schoolId")
      OR composition."gradeScaleVersion" IS DISTINCT FROM (SELECT max("version") FROM "ReportGradeScaleRevision" WHERE "schoolId"=NEW."schoolId") THEN
     RAISE EXCEPTION 'Current adopted composition policy required' USING ERRCODE='23514';
   END IF;
   NEW."publishedAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 ELSE
   NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportPublication_validate" BEFORE INSERT ON "ReportPublication"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_publication"();
CREATE TRIGGER "ReportPublicationWithdrawal_validate" BEFORE INSERT ON "ReportPublicationWithdrawal"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_publication"();

-- Every read rechecks actual identity, relationship, current enrollment and
-- withdrawal. Never use broad academic:read/child:read for recipient results.
CREATE FUNCTION "can_read_published_report"(p_school TEXT,p_publication TEXT,p_student TEXT,p_user TEXT)
RETURNS BOOLEAN AS $$
BEGIN
 RETURN EXISTS (
 SELECT 1 FROM "ReportPublication" publication
 JOIN "School" school ON school."id"=publication."schoolId" AND school."isActive"
 JOIN "PrivateOfficialReportComposition" c ON c."schoolId"=school."id" AND c."id"=publication."compositionId"
 JOIN "Membership" member ON member."schoolId"=school."id" AND member."userId"=p_user AND member."isActive"
 JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id" AND pupil."id"=p_student AND pupil."status"='ENROLLED'
 JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=school."id" AND enrollment."studentId"=pupil."id"
  AND enrollment."classId"=c."classId" AND enrollment."sessionId"=c."sessionId" AND enrollment."status"='ACTIVE'
 JOIN "AcademicSession" session ON session."schoolId"=school."id" AND session."id"=c."sessionId" AND session."status"='ACTIVE'
 JOIN "AcademicTerm" term ON term."schoolId"=school."id" AND term."id"=c."termId" AND term."sessionId"=session."id" AND term."status"='ACTIVE'
 JOIN "SchoolClass" classroom ON classroom."schoolId"=school."id" AND classroom."id"=c."classId" AND classroom."isActive"
 JOIN "SchoolSection" section ON section."schoolId"=school."id" AND section."id"=classroom."sectionId" AND section."isActive"
 WHERE publication."schoolId"=p_school AND publication."id"=p_publication
 AND EXISTS (SELECT 1 FROM jsonb_array_elements(c."composedStudentCards") card WHERE card->>'studentId'=p_student)
 AND NOT EXISTS (SELECT 1 FROM "ReportPublicationWithdrawal" w WHERE w."schoolId"=school."id" AND w."publicationId"=publication."id")
 AND (
  (member."role"='PARENT' AND publication."visibility" IN ('PARENT_ONLY','PARENT_FIRST','PARENT_AND_STUDENT')
   AND EXISTS (SELECT 1 FROM "GuardianStudentLink" link
    WHERE link."schoolId"=school."id" AND link."studentId"=pupil."id" AND link."guardianMembershipId"=member."id"
    AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" r WHERE r."schoolId"=school."id" AND r."linkId"=link."id")))
  OR (member."role"='STUDENT' AND publication."visibility" IN ('PARENT_FIRST','PARENT_AND_STUDENT')
   AND EXISTS (SELECT 1 FROM "StudentAccountLink" link WHERE link."schoolId"=school."id" AND link."studentId"=pupil."id" AND link."studentMembershipId"=member."id"
    AND NOT EXISTS (SELECT 1 FROM "StudentAccountLinkRevocation" r WHERE r."schoolId"=school."id" AND r."linkId"=link."id"))
   AND (publication."visibility"='PARENT_AND_STUDENT' OR EXISTS (
    SELECT 1 FROM "ReportGuardianAcknowledgment" acknowledgment
    JOIN "GuardianStudentLink" link ON link."schoolId"=school."id" AND link."id"=acknowledgment."guardianLinkId"
    JOIN "Membership" guardian ON guardian."schoolId"=school."id" AND guardian."id"=link."guardianMembershipId" AND guardian."role"='PARENT' AND guardian."isActive"
    WHERE acknowledgment."schoolId"=school."id" AND acknowledgment."publicationId"=publication."id" AND acknowledgment."studentId"=pupil."id"
    AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" r WHERE r."schoolId"=school."id" AND r."linkId"=link."id"))))
 ));
END;
$$ LANGUAGE plpgsql STABLE;
CREATE FUNCTION "validate_report_acknowledgment"() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive" FOR UPDATE;
 IF NOT "can_read_published_report"(NEW."schoolId",NEW."publicationId",NEW."studentId",NEW."actorUserId")
 OR NOT EXISTS (SELECT 1 FROM "GuardianStudentLink" link JOIN "Membership" m
   ON m."schoolId"=link."schoolId" AND m."id"=link."guardianMembershipId"
   WHERE link."schoolId"=NEW."schoolId" AND link."id"=NEW."guardianLinkId" AND link."studentId"=NEW."studentId"
   AND m."id"=NEW."actorMembershipId" AND m."userId"=NEW."actorUserId" AND m."role"='PARENT' AND m."isActive"
   AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" r WHERE r."schoolId"=link."schoolId" AND r."linkId"=link."id")) THEN
  RAISE EXCEPTION 'Current verified guardian required' USING ERRCODE='23503';
 END IF;
 NEW."createdAt":=(clock_timestamp() AT TIME ZONE 'UTC')::TIMESTAMP(3);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportGuardianAcknowledgment_validate" BEFORE INSERT ON "ReportGuardianAcknowledgment"
 FOR EACH ROW EXECUTE FUNCTION "validate_report_acknowledgment"();
CREATE TRIGGER "ReportPublication_immutable" BEFORE UPDATE OR DELETE ON "ReportPublication" FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportPublication_no_truncate" BEFORE TRUNCATE ON "ReportPublication" FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "ReportPublicationWithdrawal_immutable" BEFORE UPDATE OR DELETE ON "ReportPublicationWithdrawal" FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportPublicationWithdrawal_no_truncate" BEFORE TRUNCATE ON "ReportPublicationWithdrawal" FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "ReportGuardianAcknowledgment_immutable" BEFORE UPDATE OR DELETE ON "ReportGuardianAcknowledgment" FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "ReportGuardianAcknowledgment_no_truncate" BEFORE TRUNCATE ON "ReportGuardianAcknowledgment" FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

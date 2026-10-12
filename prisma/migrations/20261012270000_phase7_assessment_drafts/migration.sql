-- Phase 7 ASM-REQ-001 additive DRAFT-ONLY configuration.
-- Neither this schema nor any route publishes a test, CBT attempt or mark.
CREATE TYPE "AssessmentDraftKind" AS ENUM ('QUIZ','TEST','EXAM');

CREATE TABLE "AssessmentDraft" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL, "termId" TEXT NOT NULL,
  "classId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL, "teacherMembershipId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL, "kind" "AssessmentDraftKind" NOT NULL,
  "title" VARCHAR(180) NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL, "durationMinutes" INTEGER NOT NULL,
  "maxAttempts" INTEGER NOT NULL, "passPercent" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentDraft_rules_check" CHECK (
    char_length(btrim("title")) BETWEEN 5 AND 180 AND
    "startsAt" < "endsAt" AND
    "durationMinutes" BETWEEN 5 AND 180 AND
    "maxAttempts" BETWEEN 1 AND 3 AND
    "passPercent" BETWEEN 0 AND 100 AND
    "endsAt" - "startsAt" >= "durationMinutes" * INTERVAL '1 minute'
  )
);
CREATE UNIQUE INDEX "AssessmentDraft_schoolId_id_key"
 ON "AssessmentDraft"("schoolId","id");
CREATE INDEX "AssessmentDraft_schoolId_teacherMembershipId_createdAt_idx"
 ON "AssessmentDraft"("schoolId","teacherMembershipId","createdAt");
CREATE INDEX "AssessmentDraft_schoolId_classId_subjectId_termId_idx"
 ON "AssessmentDraft"("schoolId","classId","subjectId","termId");
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_sessionId_fkey"
 FOREIGN KEY ("schoolId","sessionId") REFERENCES "AcademicSession"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_sessionId_termId_fkey"
 FOREIGN KEY ("schoolId","sessionId","termId") REFERENCES "AcademicTerm"("schoolId","sessionId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_classId_fkey"
 FOREIGN KEY ("schoolId","classId") REFERENCES "SchoolClass"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_subjectId_fkey"
 FOREIGN KEY ("schoolId","subjectId") REFERENCES "Subject"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_schoolId_teacherMembershipId_fkey"
 FOREIGN KEY ("schoolId","teacherMembershipId") REFERENCES "Membership"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_exact_assignment_fkey"
 FOREIGN KEY ("schoolId","assignmentId","teacherMembershipId","classId","subjectId","sessionId")
 REFERENCES "TeacherClassSubjectAssignment"("schoolId","id","membershipId","classId","subjectId","sessionId")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentDraftQuestion" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL, "questionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL, "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDraftQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentDraftQuestion_rules_check"
    CHECK ("position" BETWEEN 1 AND 50 AND "points" BETWEEN 1 AND 20)
);
CREATE UNIQUE INDEX "AssessmentDraftQuestion_schoolId_draftId_position_key"
 ON "AssessmentDraftQuestion"("schoolId","draftId","position");
CREATE UNIQUE INDEX "AssessmentDraftQuestion_schoolId_draftId_questionId_key"
 ON "AssessmentDraftQuestion"("schoolId","draftId","questionId");
CREATE INDEX "AssessmentDraftQuestion_schoolId_questionId_idx"
 ON "AssessmentDraftQuestion"("schoolId","questionId");
ALTER TABLE "AssessmentDraftQuestion" ADD CONSTRAINT "AssessmentDraftQuestion_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraftQuestion" ADD CONSTRAINT "AssessmentDraftQuestion_draft_fkey"
 FOREIGN KEY ("schoolId","draftId") REFERENCES "AssessmentDraft"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraftQuestion" ADD CONSTRAINT "AssessmentDraftQuestion_question_fkey"
 FOREIGN KEY ("schoolId","questionId") REFERENCES "AssessmentQuestion"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "AssessmentDraftSeal" (
  "draftId" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDraftSeal_pkey" PRIMARY KEY ("draftId")
);
CREATE UNIQUE INDEX "AssessmentDraftSeal_schoolId_draftId_key"
 ON "AssessmentDraftSeal"("schoolId","draftId");
ALTER TABLE "AssessmentDraftSeal" ADD CONSTRAINT "AssessmentDraftSeal_schoolId_fkey"
 FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentDraftSeal" ADD CONSTRAINT "AssessmentDraftSeal_draft_fkey"
 FOREIGN KEY ("schoolId","draftId") REFERENCES "AssessmentDraft"("schoolId","id")
 ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE FUNCTION "validate_assessment_draft"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" school WHERE school."id"=NEW."schoolId"
    AND school."isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'School inactive' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Membership" teacher
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=teacher."schoolId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."id"=NEW."assignmentId"
      AND assignment."classId"=NEW."classId"
      AND assignment."subjectId"=NEW."subjectId"
      AND assignment."sessionId"=NEW."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" session
      ON session."schoolId"=assignment."schoolId"
      AND session."id"=assignment."sessionId"
      AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=session."schoolId"
      AND term."sessionId"=session."id"
      AND term."id"=NEW."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=assignment."schoolId"
      AND c."id"=assignment."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=c."schoolId"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=assignment."schoolId"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE teacher."schoolId"=NEW."schoolId"
      AND teacher."id"=NEW."teacherMembershipId"
      AND teacher."userId"=NEW."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
      AND NEW."startsAt"::date >= term."startsOn"
      AND NEW."endsAt"::date <= term."endsOn"
  ) THEN RAISE EXCEPTION 'Exact active teacher assignment and term-bound window required'
    USING ERRCODE='23503'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentDraft_validate"
 BEFORE INSERT ON "AssessmentDraft"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_draft"();

CREATE FUNCTION "validate_assessment_draft_question"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'School inactive' USING ERRCODE='23503'; END IF;
  IF EXISTS (SELECT 1 FROM "AssessmentDraftSeal" sealed
    WHERE sealed."schoolId"=NEW."schoolId" AND sealed."draftId"=NEW."draftId") THEN
    RAISE EXCEPTION 'A sealed assessment draft cannot accept new items'
      USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "AssessmentDraft" draft
    JOIN "AssessmentQuestion" question ON question."schoolId"=draft."schoolId"
      AND question."id"=NEW."questionId"
      AND question."classId"=draft."classId"
      AND question."subjectId"=draft."subjectId"
      AND question."sessionId"=draft."sessionId"
      AND question."termId"=draft."termId"
      AND question."assignmentId"=draft."assignmentId"
      AND question."teacherMembershipId"=draft."teacherMembershipId"
    JOIN "AssessmentQuestionKey" key ON key."schoolId"=question."schoolId"
      AND key."questionId"=question."id"
    JOIN "Membership" teacher ON teacher."schoolId"=draft."schoolId"
      AND teacher."id"=draft."teacherMembershipId"
      AND teacher."userId"=draft."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" session ON session."schoolId"=draft."schoolId"
      AND session."id"=draft."sessionId" AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=draft."sessionId"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
  ) THEN
    RAISE EXCEPTION 'Question selection must match exact owned draft and secret key'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentDraftQuestion_validate"
 BEFORE INSERT ON "AssessmentDraftQuestion"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_draft_question"();

CREATE FUNCTION "validate_assessment_draft_seal"() RETURNS trigger AS $$
DECLARE entry_count INTEGER;
BEGIN
  PERFORM 1 FROM "School" WHERE "id"=NEW."schoolId" AND "isActive"=true FOR UPDATE;
  SELECT COUNT(*)::int INTO entry_count
    FROM "AssessmentDraftQuestion" item
    WHERE item."schoolId"=NEW."schoolId" AND item."draftId"=NEW."draftId";
  IF entry_count < 1 OR entry_count > 50 OR NOT EXISTS (
    SELECT 1 FROM "AssessmentDraft" draft
    WHERE draft."schoolId"=NEW."schoolId" AND draft."id"=NEW."draftId"
  ) THEN
    RAISE EXCEPTION 'Only complete 1–50 question assessment drafts can be sealed'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentDraftSeal_validate"
 BEFORE INSERT ON "AssessmentDraftSeal"
 FOR EACH ROW EXECUTE FUNCTION "validate_assessment_draft_seal"();

CREATE TRIGGER "AssessmentDraft_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentDraft"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentDraftQuestion_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentDraftQuestion"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentDraft_no_truncate"
 BEFORE TRUNCATE ON "AssessmentDraft"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentDraftQuestion_no_truncate"
 BEFORE TRUNCATE ON "AssessmentDraftQuestion"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();
CREATE TRIGGER "AssessmentDraftSeal_immutable"
 BEFORE UPDATE OR DELETE ON "AssessmentDraftSeal"
 FOR EACH ROW EXECUTE FUNCTION "prevent_lesson_note_history_mutation"();
CREATE TRIGGER "AssessmentDraftSeal_no_truncate"
 BEFORE TRUNCATE ON "AssessmentDraftSeal"
 FOR EACH STATEMENT EXECUTE FUNCTION "prevent_lesson_note_history_truncate"();

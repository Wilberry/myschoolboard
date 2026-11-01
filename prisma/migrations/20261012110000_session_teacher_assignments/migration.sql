-- Add session-aware teacher assignments without rewriting historical
-- period-free rows. Existing rows remain NULL sessionId.
ALTER TABLE "TeacherClassSubjectAssignment"
ADD COLUMN "sessionId" TEXT;

-- The original index prevents using the same teacher/class/subject pair
-- in separate sessions. Replace it with explicit legacy and period indexes.
DROP INDEX "TeacherClassSubjectAssignment_schoolId_membershipId_classId_key";

CREATE UNIQUE INDEX "TeacherAssignment_legacy_unique"
ON "TeacherClassSubjectAssignment" ("schoolId", "membershipId", "classId", "subjectId")
WHERE "sessionId" IS NULL;

CREATE UNIQUE INDEX "TeacherAssignment_period_unique"
ON "TeacherClassSubjectAssignment"
("schoolId", "membershipId", "classId", "subjectId", "sessionId");

CREATE INDEX "TeacherClassSubjectAssignment_schoolId_sessionId_status_idx"
ON "TeacherClassSubjectAssignment" ("schoolId", "sessionId", "status");

ALTER TABLE "TeacherClassSubjectAssignment"
ADD CONSTRAINT "TeacherAssignment_school_session_fkey"
FOREIGN KEY ("schoolId", "sessionId")
REFERENCES "AcademicSession" ("schoolId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- Never infer sessionId from createdAt, old status, scope grants or
-- classroom placement. Past assignments remain period-free.

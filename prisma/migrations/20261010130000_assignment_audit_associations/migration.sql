-- Bind each event to the exact school, assignment, and teacher membership.
-- Existing inconsistent rows cause this migration to fail; it never rewrites history.
CREATE UNIQUE INDEX "TeacherClassSubjectAssignment_schoolId_id_membershipId_key"
ON "TeacherClassSubjectAssignment" ("schoolId", "id", "membershipId");

ALTER TABLE "TeacherClassSubjectAssignmentEvent"
ADD CONSTRAINT "TeacherClassSubjectAssignmentEvent_assignment_teacher_fkey"
FOREIGN KEY ("schoolId", "assignmentId", "teacherMembershipId")
REFERENCES "TeacherClassSubjectAssignment" ("schoolId", "id", "membershipId")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- Actor membership identifiers are immutable historical snapshots. Validate
-- their school/user association when writing an event, but do not add a foreign
-- key: later user or membership deletion must not rewrite/delete event history.
CREATE FUNCTION "validate_teacher_assignment_event_actor"() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "Membership" AS membership
        WHERE membership."id" = NEW."actorMembershipId"
          AND membership."schoolId" = NEW."schoolId"
          AND membership."userId" = NEW."actorUserId"
    ) THEN
        RAISE EXCEPTION 'Teacher assignment audit actor does not match school membership'
            USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherClassSubjectAssignmentEvent_validate_actor"
BEFORE INSERT ON "TeacherClassSubjectAssignmentEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_teacher_assignment_event_actor"();

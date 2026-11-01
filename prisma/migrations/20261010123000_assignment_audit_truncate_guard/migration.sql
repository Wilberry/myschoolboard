CREATE FUNCTION "prevent_teacher_assignment_event_truncate"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Teacher assignment audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherClassSubjectAssignmentEvent_no_truncate"
BEFORE TRUNCATE ON "TeacherClassSubjectAssignmentEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_teacher_assignment_event_truncate"();

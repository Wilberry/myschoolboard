-- CreateEnum
CREATE TYPE "TeacherClassSubjectAssignmentEventType" AS ENUM ('CREATED', 'DEACTIVATED', 'REVOKED', 'REACTIVATED');

-- CreateTable
CREATE TABLE "TeacherClassSubjectAssignmentEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorMembershipId" TEXT NOT NULL,
    "teacherMembershipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "eventType" "TeacherClassSubjectAssignmentEventType" NOT NULL,
    "previousStatus" "TeacherClassSubjectAssignmentStatus",
    "newStatus" "TeacherClassSubjectAssignmentStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherClassSubjectAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherClassSubjectAssignmentEvent_schoolId_createdAt_idx" ON "TeacherClassSubjectAssignmentEvent"("schoolId", "createdAt");
CREATE INDEX "TeacherClassSubjectAssignmentEvent_schoolId_assignmentId_cr_idx" ON "TeacherClassSubjectAssignmentEvent"("schoolId", "assignmentId", "createdAt");
CREATE INDEX "TeacherClassSubjectAssignmentEvent_schoolId_actorUserId_cre_idx" ON "TeacherClassSubjectAssignmentEvent"("schoolId", "actorUserId", "createdAt");
CREATE INDEX "TeacherClassSubjectAssignmentEvent_schoolId_teacherMembersh_idx" ON "TeacherClassSubjectAssignmentEvent"("schoolId", "teacherMembershipId", "createdAt");

-- CreateForeignKey
ALTER TABLE "TeacherClassSubjectAssignmentEvent" ADD CONSTRAINT "TeacherClassSubjectAssignmentEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict direct event mutation while permitting existing school-level cascade cleanup.
CREATE FUNCTION "prevent_teacher_assignment_event_mutation"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Teacher assignment audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherClassSubjectAssignmentEvent_immutable"
BEFORE UPDATE OR DELETE ON "TeacherClassSubjectAssignmentEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_teacher_assignment_event_mutation"();

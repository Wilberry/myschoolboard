import {
  handleTeacherAssignmentMutation,
  reasonBody,
} from "@/src/modules/teacher-assignments/http";
import { deactivateTeacherClassSubjectAssignment } from "@/src/modules/teacher-assignments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; assignmentId: string }> },
) {
  return handleTeacherAssignmentMutation({
    request,
    params,
    schema: reasonBody,
    operation: "deactivate",
    mutate: (input) => deactivateTeacherClassSubjectAssignment(input),
  });
}

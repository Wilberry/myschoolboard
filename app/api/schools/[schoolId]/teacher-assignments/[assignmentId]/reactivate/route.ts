import {
  handleTeacherAssignmentMutation,
  optionalReasonBody,
} from "@/src/modules/teacher-assignments/http";
import { reactivateTeacherClassSubjectAssignment } from "@/src/modules/teacher-assignments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; assignmentId: string }> },
) {
  return handleTeacherAssignmentMutation({
    request,
    params,
    schema: optionalReasonBody,
    operation: "reactivate",
    mutate: (input) => reactivateTeacherClassSubjectAssignment(input),
  });
}

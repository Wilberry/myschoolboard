import {
  handleTeacherAssignmentMutation,
  reasonBody,
} from "@/src/modules/teacher-assignments/http";
import { revokeTeacherClassSubjectAssignment } from "@/src/modules/teacher-assignments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; assignmentId: string }> },
) {
  return handleTeacherAssignmentMutation({
    request,
    params,
    schema: reasonBody,
    operation: "revoke",
    mutate: (input) => revokeTeacherClassSubjectAssignment(input),
  });
}

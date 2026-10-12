import {
  createAssignmentBody,
  handleTeacherAssignmentMutation,
} from "@/src/modules/teacher-assignments/http";
import {
  createTeacherClassSubjectAssignment,
} from "@/src/modules/teacher-assignments/service";
import {
  handleTeacherAssignmentRead,
} from "@/src/modules/teacher-assignments/read-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleTeacherAssignmentMutation({
    request,
    params,
    schema: createAssignmentBody,
    operation: "create",
    status: 201,
    mutate: (input) => createTeacherClassSubjectAssignment(input),
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleTeacherAssignmentRead({
    request,
    params,
    operation: "list",
  });
}

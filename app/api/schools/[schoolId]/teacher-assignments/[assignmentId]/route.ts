import {
  handleTeacherAssignmentRead,
} from "@/src/modules/teacher-assignments/read-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; assignmentId: string }> },
) {
  return handleTeacherAssignmentRead({
    request,
    params,
    operation: "detail",
  });
}

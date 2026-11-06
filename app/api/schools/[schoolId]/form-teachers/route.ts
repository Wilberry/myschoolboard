import { handleAssignFormTeacher } from "@/src/modules/form-teachers/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleAssignFormTeacher(request, params);
}

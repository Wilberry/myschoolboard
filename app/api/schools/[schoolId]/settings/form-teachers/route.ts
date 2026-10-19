import { handleUpdateFormTeacherPolicy } from "@/src/modules/form-teachers/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleUpdateFormTeacherPolicy(request, params);
}

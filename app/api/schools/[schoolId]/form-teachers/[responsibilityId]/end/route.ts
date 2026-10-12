import {
  handleEndFormTeacher,
} from "@/src/modules/form-teachers/http";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ schoolId: string; responsibilityId: string }>;
  },
) {
  return handleEndFormTeacher(request, params);
}

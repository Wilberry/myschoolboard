import { handleSchoolLifecycleChange } from "@/src/modules/platform/school-lifecycle-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleSchoolLifecycleChange(request, params);
}

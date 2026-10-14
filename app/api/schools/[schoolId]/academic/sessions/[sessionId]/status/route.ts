import { handleAcademicPeriodChange } from "@/src/modules/academics/period-lifecycle-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; sessionId: string }> },
) {
  return handleAcademicPeriodChange(request, params);
}

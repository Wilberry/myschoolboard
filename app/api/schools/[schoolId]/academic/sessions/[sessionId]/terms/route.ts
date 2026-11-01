import { handleAcademicConfigCreate } from "@/src/modules/academics/config-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; sessionId: string }> },
) {
  return handleAcademicConfigCreate(request, params, "term");
}

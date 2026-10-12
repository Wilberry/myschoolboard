import { handleAcademicConfigCreate } from "@/src/modules/academics/config-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleAcademicConfigCreate(request, params, "subject");
}

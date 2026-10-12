import { handleSectionMutation } from "@/src/modules/sections/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleSectionMutation(request, params, "create");
}

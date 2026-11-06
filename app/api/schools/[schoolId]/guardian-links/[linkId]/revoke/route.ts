import { handleGuardianLink } from "@/src/modules/students/guardian-link-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; linkId: string }> },
) {
  return handleGuardianLink(request, params, "revoke");
}

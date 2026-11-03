import { handleGuardianLink } from "@/src/modules/students/guardian-link-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleGuardianLink(request, params, "attest");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleGuardianLink(request, params, "list");
}

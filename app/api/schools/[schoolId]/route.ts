import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { requireSchoolAccess } from "@/src/modules/tenancy/school-access";

function schoolResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function logSchoolReadFailure(error: unknown): void {
  try {
    console.error(
      JSON.stringify({
        event: "school_read_failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
  } catch {
    // Log transport failures must not disclose details or prevent a safe denial.
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return schoolResponse({ error: "Unauthorized" }, 401);

    const { schoolId } = await params;
    const access = await requireSchoolAccess(session.user.id, schoolId);
    if (!access) return schoolResponse({ error: "Not found" }, 404);

    return schoolResponse({ school: access.school });
  } catch (error) {
    logSchoolReadFailure(error);
    return schoolResponse({ error: "Request could not be completed" }, 500);
  }
}

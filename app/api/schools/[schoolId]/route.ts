import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { requireSchoolAccess } from "@/src/modules/tenancy/school-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { schoolId } = await params;
    const access = await requireSchoolAccess(session.user.id, schoolId);
    if (!access) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ school: access.school });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "school_read_failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    return Response.json(
      { error: "Request could not be completed" },
      { status: 500 },
    );
  }
}

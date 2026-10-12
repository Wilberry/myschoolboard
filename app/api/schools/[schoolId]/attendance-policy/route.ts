import { AcademicConfigError } from "@/src/modules/academics/config-service";
import { changeAttendanceDatePolicy } from "@/src/modules/attendance/policy-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    if (request.method !== "POST" || new URL(request.url).search) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: noStore });
    }
    const { schoolId } = await params;
    const body: unknown = await request.json();
    const policy = await changeAttendanceDatePolicy(schoolId, body);
    return Response.json({ policy }, { status: 201, headers: noStore });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400
      : error instanceof AcademicConfigError
        ? error.code === "UNAUTHENTICATED" ? 401
          : error.code === "INVALID_INPUT" ? 400
          : error.code === "CONFLICT" ? 409
          : error.code === "FORBIDDEN" || error.code === "NOT_FOUND" ? 404 : 500
        : 500;
    return Response.json(
      { error: status === 401 ? "Unauthorized" : status === 404 ? "Not found"
        : status === 400 ? "Invalid request" : status === 409 ? "Conflict"
          : "Request could not be completed" },
      { status, headers: noStore },
    );
  }
}

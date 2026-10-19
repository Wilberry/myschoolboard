import { revokeStudentAccountLink } from "@/src/modules/students/account-link-service";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; linkId: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (new URL(request.url).search)
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers },
      );
    const { schoolId, linkId } = await params;
    return Response.json(
      {
        revocation: await revokeStudentAccountLink(
          schoolId,
          linkId,
          await request.json(),
        ),
      },
      { status: 201, headers },
    );
  } catch (error) {
    const code =
      error instanceof AcademicConfigError
        ? error.code
        : error instanceof SyntaxError
          ? "INVALID_INPUT"
          : "INTERNAL";
    const status =
      code === "UNAUTHENTICATED"
        ? 401
        : code === "INVALID_INPUT"
          ? 400
          : code === "CONFLICT"
            ? 409
            : code === "FORBIDDEN" || code === "NOT_FOUND"
              ? 404
              : 500;
    return Response.json(
      {
        error:
          status === 401
            ? "Unauthorized"
            : status === 400
              ? "Invalid request"
              : status === 409
                ? "Conflict"
                : status === 404
                  ? "Not found"
                  : "Request could not be completed",
      },
      { status, headers },
    );
  }
}

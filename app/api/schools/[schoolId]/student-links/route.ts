import {
  attestStudentAccount,
  readStudentLinksForAdmin,
} from "@/src/modules/students/account-link-service";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
function failure(error: unknown) {
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
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search)
      return failure(new AcademicConfigError("INVALID_INPUT"));
    const { schoolId } = await params;
    return Response.json(
      { link: await attestStudentAccount(schoolId, await request.json()) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search)
      return failure(new AcademicConfigError("INVALID_INPUT"));
    const { schoolId } = await params;
    return Response.json(
      { links: await readStudentLinksForAdmin(schoolId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

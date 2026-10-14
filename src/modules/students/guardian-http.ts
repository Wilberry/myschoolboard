import { AcademicConfigError } from "@/src/modules/academics/config-service";
export const guardianHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
};
export function guardianHttpError(error: unknown) {
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
        : code === "FORBIDDEN" || code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
            : 500;
  return Response.json(
    {
      error:
        status === 401
          ? "Unauthorized"
          : status === 400
            ? "Invalid request"
            : status === 404
              ? "Not found"
              : status === 409
                ? "Conflict"
                : "Request failed",
    },
    { status, headers: guardianHeaders },
  );
}

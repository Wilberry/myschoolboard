import { AssessmentError } from "./question-service";
export const manualHeaders = { "Cache-Control": "private, no-store" };
export function manualError(error: unknown) {
  const code = error instanceof SyntaxError ? "INVALID_INPUT"
    : error instanceof AssessmentError ? error.code : "INTERNAL";
  const status = code === "UNAUTHENTICATED" ? 401
    : code === "INVALID_INPUT" ? 400
    : code === "NOT_FOUND" || code === "FORBIDDEN" ? 404
    : code === "CONFLICT" ? 409 : 500;
  return Response.json({ error: status === 401 ? "Unauthorized"
    : status === 400 ? "Invalid request"
    : status === 404 ? "Not found"
    : status === 409 ? "Conflict" : "Request failed" },
    { status, headers: manualHeaders });
}

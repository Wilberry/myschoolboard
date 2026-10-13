import { AssessmentError } from "@/src/modules/assessments/question-service";
export const reportHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export function reportHttpError(error: unknown) {
  const code = error instanceof AssessmentError ? error.code
    : error instanceof SyntaxError ? "INVALID_INPUT" : "INTERNAL";
  const status = code === "UNAUTHENTICATED" ? 401
    : code === "INVALID_INPUT" ? 400
    : code === "CONFLICT" ? 409
    : code === "NOT_FOUND" || code === "FORBIDDEN" ? 404 : 500;
  return Response.json({
    error: status === 401 ? "Unauthorized"
      : status === 400 ? "Invalid request"
      : status === 409 ? "Conflict"
      : status === 404 ? "Not found" : "Request failed",
  }, { status, headers: reportHeaders });
}
export function requireJsonPost(request: Request) {
  if (new URL(request.url).search ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new AssessmentError("INVALID_INPUT");
}
export function requireUnparameterizedGet(request: Request) {
  if (new URL(request.url).search)
    throw new AssessmentError("INVALID_INPUT");
}

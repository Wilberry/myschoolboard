import { scoreInternalSubmittedAttempt } from "@/src/modules/assessments/objective-score-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string; attemptId: string }> }) {
  try {
    if (new URL(request.url).search || request.headers.get("content-length") !== "0") {
      // Only an empty POST may initiate automatic objective marking.
      if (new URL(request.url).search ||
        Number(request.headers.get("content-length") ?? 0) !== 0) {
        return Response.json({ error: "Invalid request" }, { status: 400, headers });
      }
    }
    const { schoolId, attemptId } = await params;
    const score = await scoreInternalSubmittedAttempt(schoolId, attemptId);
    return Response.json({ score, status: "PROVISIONAL" }, { headers });
  } catch (error) {
    const code = error instanceof AssessmentError ? error.code : "INTERNAL";
    const status = code === "UNAUTHENTICATED" ? 401
      : code === "INVALID_INPUT" ? 400
      : code === "NOT_FOUND" || code === "FORBIDDEN" ? 404
      : code === "CONFLICT" ? 409 : 500;
    return Response.json({ error: status === 401 ? "Unauthorized"
      : status === 400 ? "Invalid request"
      : status === 404 ? "Not found" : status === 409
        ? "Conflicting request" : "Request failed" }, { status, headers });
  }
}

import { decideAssessmentReview } from "@/src/modules/assessments/review-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string; draftId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    }
    const { schoolId, draftId } = await params;
    const event = await decideAssessmentReview(schoolId, draftId, await request.json());
    return Response.json({ event }, { status: 201, headers });
  } catch (error) {
    const code = error instanceof SyntaxError ? "INVALID_INPUT"
      : error instanceof AssessmentError ? error.code : "INTERNAL";
    const status = code === "UNAUTHENTICATED" ? 401
      : code === "INVALID_INPUT" ? 400 : code === "CONFLICT" ? 409
      : code === "FORBIDDEN" || code === "NOT_FOUND" ? 404 : 500;
    return Response.json({
      error: status === 401 ? "Unauthorized" : status === 400 ? "Invalid request"
        : status === 409 ? "Conflict" : status === 404 ? "Not found"
          : "Request could not be completed",
    }, { status, headers });
  }
}

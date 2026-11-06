import { readAssessmentReviewItems } from "@/src/modules/assessments/review-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; draftId: string }> },
) {
  try {
    if (new URL(request.url).search) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers },
      );
    }
    const { schoolId, draftId } = await params;
    return Response.json(
      {
        items: await readAssessmentReviewItems(schoolId, draftId),
      },
      { headers },
    );
  } catch (error) {
    const code = error instanceof AssessmentError ? error.code : "INTERNAL";
    const status =
      code === "UNAUTHENTICATED"
        ? 401
        : code === "INVALID_INPUT"
          ? 400
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
              : status === 404
                ? "Not found"
                : "Request could not be completed",
      },
      { status, headers },
    );
  }
}

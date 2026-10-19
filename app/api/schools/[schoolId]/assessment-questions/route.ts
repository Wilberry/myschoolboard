import {
  AssessmentError,
  createAssessmentQuestion,
  listOwnAssessmentQuestions,
} from "@/src/modules/assessments/question-service";

const responseHeaders = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const code =
    error instanceof SyntaxError
      ? "INVALID_INPUT"
      : error instanceof AssessmentError
        ? error.code
        : "INTERNAL";
  const status =
    code === "UNAUTHENTICATED"
      ? 401
      : code === "INVALID_INPUT"
        ? 400
        : code === "CONFLICT"
          ? 409
          : code === "NOT_FOUND" || code === "FORBIDDEN"
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
    { status, headers: responseHeaders },
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (
      new URL(request.url).search ||
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      return failure(new AssessmentError("INVALID_INPUT"));
    }
    const { schoolId } = await params;
    const question = await createAssessmentQuestion(
      schoolId,
      await request.json(),
    );
    return Response.json(
      { question },
      { status: 201, headers: responseHeaders },
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
      return failure(new AssessmentError("INVALID_INPUT"));
    const { schoolId } = await params;
    return Response.json(
      { questions: await listOwnAssessmentQuestions(schoolId) },
      { headers: responseHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}

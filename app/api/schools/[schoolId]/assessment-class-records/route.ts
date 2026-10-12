import { readInternalTeacherClassRecord } from "@/src/modules/assessments/class-record-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";
const responseHeaders = { "Cache-Control": "private, no-store" };
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    const url = new URL(request.url);
    const expected = ["classId","sessionId","subjectId","termId"];
    if (url.searchParams.size !== 4 ||
      Array.from(url.searchParams.keys()).some(k => !expected.includes(k))) {
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: responseHeaders });
    }
    const { schoolId } = await params;
    const [classId, sessionId, subjectId, termId] = expected.map(
      k => url.searchParams.get(k) ?? "",
    );
    const sheet = await readInternalTeacherClassRecord(
      schoolId, sessionId, termId, classId, subjectId,
    );
    return Response.json({ sheet, status: "PROVISIONAL" },
      { headers: responseHeaders });
  } catch (error) {
    const code = error instanceof AssessmentError ? error.code : "INTERNAL";
    const status = code === "UNAUTHENTICATED" ? 401
      : code === "INVALID_INPUT" ? 400
      : code === "FORBIDDEN" || code === "NOT_FOUND" ? 404
      : code === "CONFLICT" ? 409 : 500;
    return Response.json({ error: status === 401 ? "Unauthorized"
      : status === 400 ? "Invalid request"
      : status === 404 ? "Not found"
      : status === 409 ? "Record data needs review"
      : "Request could not be completed" }, { status, headers: responseHeaders });
  }
}

import {
  createInternalGradingPolicyRevision, listOwnGradingPolicyRevisions,
} from "@/src/modules/assessments/grading-policy-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";

const headers = { "Cache-Control": "private, no-store" };
function failed(error: unknown) {
  const code = error instanceof SyntaxError ? "INVALID_INPUT"
    : error instanceof AssessmentError ? error.code : "INTERNAL";
  const status = code === "UNAUTHENTICATED" ? 401 :
    code === "INVALID_INPUT" ? 400 :
    code === "FORBIDDEN" || code === "NOT_FOUND" ? 404 :
    code === "CONFLICT" ? 409 : 500;
  return Response.json({ error: status === 401 ? "Unauthorized"
    : status === 400 ? "Invalid request"
    : status === 404 ? "Not found"
    : status === 409 ? "Conflict" : "Request failed" }, { status, headers });
}
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search) return Response.json(
      { error: "Invalid request" }, { status: 400, headers });
    const { schoolId } = await params;
    return Response.json({
      policies: await listOwnGradingPolicyRevisions(schoolId),
      status: "DRAFT_PREVIEW_ONLY",
    }, { headers });
  } catch (error) { return failed(error); }
}
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    }
    const { schoolId } = await params;
    return Response.json({
      policy: await createInternalGradingPolicyRevision(schoolId, await request.json()),
    }, { status: 201, headers });
  } catch (error) { return failed(error); }
}

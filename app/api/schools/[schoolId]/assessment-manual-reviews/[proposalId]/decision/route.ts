import { decideInitialManualMark } from "@/src/modules/assessments/manual-review-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";
export async function POST(request: Request, { params }:
 { params: Promise<{ schoolId: string; proposalId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: manualHeaders });
    }
    const { schoolId, proposalId } = await params;
    return Response.json({
      decision: await decideInitialManualMark(schoolId, proposalId, await request.json()),
      status: "ACADEMIC_REVIEW_ONLY",
    }, { status: 201, headers: manualHeaders });
  } catch(e) { return manualError(e); }
}

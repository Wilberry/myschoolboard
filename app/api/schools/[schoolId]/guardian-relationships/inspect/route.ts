import {
  inspectPrivateReportRecipientRelationship,
} from "@/src/modules/results/guardian-relationship-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** Diagnostic is NOT a student/guardian reader, nor any grade access token. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    }
    const { schoolId } = await params;
    return Response.json({
      ...await inspectPrivateReportRecipientRelationship(schoolId, await request.json()),
      purpose: "PRIVATE_RELATIONSHIP_DIAGNOSTIC_NOT_PUBLICATION",
    }, { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

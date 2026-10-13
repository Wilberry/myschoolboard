import {
  listGuardianRelationshipEvents,
  recordGuardianRelationshipEvent,
} from "@/src/modules/results/guardian-relationship-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** Only a current exact School Super Admin can attest/revoke links. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search) {
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    }
    const { schoolId } = await params;
    return Response.json({
      events: await listGuardianRelationshipEvents(schoolId),
      status: "PRIVATE_RELATIONSHIP_HISTORY_NO_REPORT_ACCESS",
    }, { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

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
      event: await recordGuardianRelationshipEvent(schoolId, await request.json()),
      status: "RELATIONSHIP_EVIDENCE_ONLY_NO_REPORT_RELEASE",
    }, { status: 201, headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

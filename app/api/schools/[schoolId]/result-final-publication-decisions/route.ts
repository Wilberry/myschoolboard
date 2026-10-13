import {
  listOwnFinalPublicationDecisions, recordInternalFinalPublicationDecision,
} from "@/src/modules/results/final-publication-decision-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** School Super Admin audit metadata only. Never an official result API. */
export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search)
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      decisions: await listOwnFinalPublicationDecisions(schoolId),
      status: "OWNER_APPROVAL_HISTORY_PRIVATE_NOT_RELEASED",
    }, { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

/** Audited final owner approval awaiting separate recipient release controls. */
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      decision: await recordInternalFinalPublicationDecision(schoolId, await request.json()),
      status: "FINAL_OWNER_APPROVED_AWAITING_RELEASE_NOT_PUBLIC",
    }, { status: 201, headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

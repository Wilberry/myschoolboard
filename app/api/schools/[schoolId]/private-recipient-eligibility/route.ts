import {
  listPrivateRecipientEligibilityEvidence,
  recordPrivateRecipientEligibilityEvidence,
} from "@/src/modules/results/private-recipient-eligibility-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** School Super Admin only. Neither handler can publish or read a grade. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json({
      evidence: await listPrivateRecipientEligibilityEvidence(schoolId),
      status: "INTERNAL_RECIPIENT_REVIEW_NO_REPORT_ACCESS",
    }, { headers: manualHeaders });
  } catch (error) {
    return manualError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json({
      evidence: await recordPrivateRecipientEligibilityEvidence(
        schoolId, await request.json(),
      ),
      status: "INTERNAL_REVIEW_ONLY_NOT_AUTHORIZED_OR_RELEASED",
    }, { status: 201, headers: manualHeaders });
  } catch (error) {
    return manualError(error);
  }
}

import { listManualCorrectionReviewQueue } from "@/src/modules/assessments/manual-correction-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    if (new URL(request.url).search)
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    const { schoolId } = await params;
    return Response.json(
      { requests: await listManualCorrectionReviewQueue(schoolId) },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

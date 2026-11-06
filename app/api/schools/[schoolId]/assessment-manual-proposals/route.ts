import { proposeManualAssessmentMark } from "@/src/modules/assessments/manual-mark-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";
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
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      {
        proposal: await proposeManualAssessmentMark(
          schoolId,
          await request.json(),
        ),
        status: "UNAPPROVED_NOT_SCORED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

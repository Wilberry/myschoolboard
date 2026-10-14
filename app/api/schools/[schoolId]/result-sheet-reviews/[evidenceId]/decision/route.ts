import { decideResultSheetAcademicReview } from "@/src/modules/results/result-sheet-evidence-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; evidenceId: string }> },
) {
  try {
    if (
      new URL(request.url).search ||
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    const { schoolId, evidenceId } = await params;
    return Response.json(
      {
        decision: await decideResultSheetAcademicReview(
          schoolId,
          evidenceId,
          await request.json(),
        ),
        status: "ACADEMIC_REVIEW_ONLY_NOT_PUBLISHED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

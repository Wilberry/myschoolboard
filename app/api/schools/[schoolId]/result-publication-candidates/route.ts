import { listInternalResultPublicationCandidates } from "@/src/modules/results/publication-candidate-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";

/** Inspection only. Final result publication and student access are disabled. */
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
      {
        candidates: await listInternalResultPublicationCandidates(schoolId),
        status: "INTERNAL_PREFLIGHT_ONLY_NOT_PUBLISHED",
      },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

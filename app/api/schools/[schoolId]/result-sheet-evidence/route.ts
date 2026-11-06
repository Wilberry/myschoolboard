import {
  listOwnResultSheetEvidence,
  prepareInternalResultSheetEvidence,
} from "@/src/modules/results/result-sheet-evidence-service";
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
      { snapshots: await listOwnResultSheetEvidence(schoolId) },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}
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
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    const { schoolId } = await params;
    return Response.json(
      {
        evidence: await prepareInternalResultSheetEvidence(
          schoolId,
          await request.json(),
        ),
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

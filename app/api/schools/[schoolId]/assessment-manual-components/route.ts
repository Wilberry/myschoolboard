import {
  createManualAssessmentComponent,
  listOwnManualComponents,
} from "@/src/modules/assessments/manual-mark-service";
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
      { components: await listOwnManualComponents(schoolId) },
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
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      {
        component: await createManualAssessmentComponent(
          schoolId,
          await request.json(),
        ),
        status: "UNAPPROVED_PROPOSALS_ONLY",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

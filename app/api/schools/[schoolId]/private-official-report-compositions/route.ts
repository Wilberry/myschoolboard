import {
  listPrivateOfficialReportCompositions,
  preparePrivateOfficialReportComposition,
} from "@/src/modules/results/private-official-report-composition-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";

/** Owner-only immutable private metadata. No pupil/guardian/public report API. */
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
        compositions: await listPrivateOfficialReportCompositions(schoolId),
        status: "PRIVATE_OFFICIAL_REPORT_EVIDENCE_NOT_RELEASED",
      },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

/** Server loads exact packet; SQL derives every pupil's grade and pins policy. */
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
        composition: await preparePrivateOfficialReportComposition(
          schoolId,
          await request.json(),
        ),
        status: "PRIVATE_COMPOSITION_FROZEN_NOT_PUBLISHED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

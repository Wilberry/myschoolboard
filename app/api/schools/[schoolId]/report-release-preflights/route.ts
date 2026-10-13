import {
  listInternalReportReleasePreflights,
  recordInternalReportReleasePreflight,
} from "@/src/modules/results/internal-report-release-preflight-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** ONLY a private audit of current preconditions, never publication. */
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
    return Response.json(
      {
        preflights: await listInternalReportReleasePreflights(schoolId),
        status: "INTERNAL_PREFLIGHT_HISTORY_NOT_PUBLICATION",
      },
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
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      {
        preflight: await recordInternalReportReleasePreflight(
          schoolId,
          await request.json(),
        ),
        status: "INTERNAL_PREFLIGHT_ONLY_NOT_AUTHORIZED_OR_RELEASED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

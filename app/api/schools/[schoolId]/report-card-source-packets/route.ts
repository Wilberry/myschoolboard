import {
  listPrivateReportCardSourcePackets,
  preparePrivateReportCardSourcePacket,
} from "@/src/modules/results/report-card-source-packet-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";

/** Private internal metadata only. NO official report-card download or release. */
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
        packets: await listPrivateReportCardSourcePackets(schoolId),
        status: "PRIVATE_SOURCE_ONLY_NOT_GRADED_NOT_RELEASED",
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
        packet: await preparePrivateReportCardSourcePacket(
          schoolId,
          await request.json(),
        ),
        status: "PRIVATE_SOURCE_PREPARED_NOT_GRADED_NOT_RELEASED",
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

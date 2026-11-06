import {
  listReportPublications,
  listReportPublicationCompositions,
  publishReport,
} from "@/src/modules/results/publication-service";
import {
  manualError,
  manualHeaders,
} from "@/src/modules/assessments/manual-http";
async function mutate(
  request: Request,
  params: Promise<{ schoolId: string }>,
  withdrawal: boolean,
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
    return Response.json(
      {
        events: await publishReport(
          (await params).schoolId,
          await request.json(),
          withdrawal,
        ),
      },
      { status: 201, headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return mutate(request, params, false);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return mutate(request, params, true);
}

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
    return Response.json(
      {
        publications: await listReportPublications((await params).schoolId),
        compositions: await listReportPublicationCompositions(
          (await params).schoolId,
        ),
      },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

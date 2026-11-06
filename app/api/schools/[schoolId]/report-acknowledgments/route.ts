import { acknowledgePublishedReport } from "@/src/modules/results/publication-service";
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
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    return Response.json(
      {
        acknowledgments: await acknowledgePublishedReport(
          (await params).schoolId,
          await request.json(),
        ),
      },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

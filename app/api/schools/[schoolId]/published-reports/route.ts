import { readPublishedReports } from "@/src/modules/results/publication-service";
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
    return Response.json(
      { reports: await readPublishedReports((await params).schoolId) },
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

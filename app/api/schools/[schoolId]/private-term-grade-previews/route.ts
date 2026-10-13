import {
  previewPrivateOwnerStudentTerm,
} from "@/src/modules/results/private-term-grade-preview-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** No GET, recipients, download, public access, or grade export handler. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const target = new URL(request.url);
    const origin = request.headers.get("origin");
    if (
      target.search ||
      (origin !== null && origin !== target.origin) ||
      !request.headers.get("content-type")?.toLowerCase()
        .startsWith("application/json")
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      await previewPrivateOwnerStudentTerm(schoolId, await request.json()),
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

import { previewPrivateOwnerStudentGrade } from "@/src/modules/results/private-owner-grade-preview-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

/** Exact one-pupil School Super Admin preview. No GET, export or recipients. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const target = new URL(request.url);
    // Fail closed on cross-origin browser POSTs, even when a valid cookie
    // is present. No third-party origin may invoke this sensitive preview.
    const origin = request.headers.get("origin");
    if (
      target.search ||
      (origin !== null && origin !== target.origin) ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")
    ) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: manualHeaders },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      await previewPrivateOwnerStudentGrade(schoolId, await request.json()),
      { headers: manualHeaders },
    );
  } catch (error) {
    return manualError(error);
  }
}

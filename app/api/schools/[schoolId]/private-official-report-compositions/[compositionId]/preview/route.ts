import { readPrivateGradePreview } from "@/src/modules/results/private-grade-preview-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

const previewHeaders = {
  ...manualHeaders,
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "Referrer-Policy": "no-referrer",
};

/** Sensitive private owner preview, not an official published report.
 * No POST/PUT/PATCH/DELETE, export, student or guardian route.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; compositionId: string }> },
) {
  try {
    if (new URL(request.url).search) {
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: previewHeaders });
    }
    const { schoolId, compositionId } = await params;
    return Response.json({
      preview: await readPrivateGradePreview(schoolId, compositionId),
    }, { headers: previewHeaders });
  } catch (error) {
    const response = manualError(error);
    for (const [name, value] of Object.entries(previewHeaders))
      response.headers.set(name, value);
    return response;
  }
}

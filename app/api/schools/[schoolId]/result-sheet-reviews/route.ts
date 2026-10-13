import { listResultSheetAcademicReviewQueue } from "@/src/modules/results/result-sheet-evidence-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";
export async function GET(request: Request,
 { params }: { params: Promise<{ schoolId: string }> }) {
 try {
  if (new URL(request.url).search)
    return Response.json({ error: "Invalid request" }, { status: 400, headers: manualHeaders });
  const { schoolId } = await params;
  return Response.json({ candidates: await listResultSheetAcademicReviewQueue(schoolId) },
    { headers: manualHeaders });
 } catch(error) { return manualError(error); }
}

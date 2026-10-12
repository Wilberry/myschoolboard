import { listOwnManualComponentStudents } from "@/src/modules/assessments/manual-mark-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";
export async function GET(request: Request, { params }: {
  params: Promise<{ schoolId: string; componentId: string }>
}) {
  try {
    if (new URL(request.url).search) return Response.json(
      { error: "Invalid request" }, { status: 400, headers: manualHeaders });
    const { schoolId, componentId } = await params;
    return Response.json({
      students: await listOwnManualComponentStudents(schoolId, componentId),
    }, { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

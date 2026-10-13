import {
  adoptResultGradingPolicy, listOwnGradingAdoptions,
} from "@/src/modules/results/grading-adoption-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";

export async function GET(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search)
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({ adoptions: await listOwnGradingAdoptions(schoolId) },
      { headers: manualHeaders });
  } catch (error) { return manualError(error); }
}
export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    if (new URL(request.url).search ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return Response.json({ error: "Invalid request" },
        { status: 400, headers: manualHeaders });
    const { schoolId } = await params;
    return Response.json({
      adoption: await adoptResultGradingPolicy(schoolId, await request.json()),
      status: "ACADEMIC_POLICY_ADOPTED_NOT_PUBLISHED",
    }, { status: 201, headers: manualHeaders });
  } catch (error) { return manualError(error); }
}

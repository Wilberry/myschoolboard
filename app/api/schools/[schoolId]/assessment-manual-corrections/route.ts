import {
  listOwnManualMarkCorrectionContext, requestManualMarkCorrection,
} from "@/src/modules/assessments/manual-correction-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";
export async function GET(request: Request, { params }:
 { params: Promise<{ schoolId: string }> }) {
 try {
  if(new URL(request.url).search) return Response.json({error:"Invalid request"},
    {status:400,headers:manualHeaders});
  const {schoolId}=await params;
  return Response.json({marks:await listOwnManualMarkCorrectionContext(schoolId),
    status:"TEACHER_APPROVED_MARK_HISTORY"}, {headers:manualHeaders});
 } catch(error){return manualError(error);}
}
export async function POST(request: Request, { params }:
 { params: Promise<{ schoolId: string }> }) {
 try {
  if(new URL(request.url).search ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return Response.json({error:"Invalid request"}, {status:400,headers:manualHeaders});
  const {schoolId}=await params;
  return Response.json({
   request:await requestManualMarkCorrection(schoolId,await request.json()),
   status:"PENDING_INDEPENDENT_REVIEW",
  },{status:201,headers:manualHeaders});
 } catch(error){return manualError(error);}
}

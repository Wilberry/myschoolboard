import { decideManualMarkCorrection } from "@/src/modules/assessments/manual-correction-service";
import { manualError,manualHeaders } from "@/src/modules/assessments/manual-http";
export async function POST(request:Request,{params}:
 {params:Promise<{schoolId:string;requestId:string}>}){
 try{
  if(new URL(request.url).search ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return Response.json({error:"Invalid request"}, {status:400,headers:manualHeaders});
  const {schoolId,requestId}=await params;
  return Response.json({decision:await decideManualMarkCorrection(
    schoolId,requestId,await request.json()),status:"IMMUTABLE_ACADEMIC_DECISION"},
    {status:201,headers:manualHeaders});
 }catch(error){return manualError(error);}
}

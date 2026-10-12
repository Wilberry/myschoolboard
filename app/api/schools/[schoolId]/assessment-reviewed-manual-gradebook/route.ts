import { readInternalReviewedManualGradebook } from "@/src/modules/assessments/reviewed-manual-gradebook-service";
import { manualError, manualHeaders } from "@/src/modules/assessments/manual-http";
export async function GET(request:Request,{params}:
 {params:Promise<{schoolId:string}>}){
 try{
  const query=new URL(request.url).searchParams;
  const keys=["classId","sessionId","termId","subjectId"];
  if(query.size!==4||Array.from(query.keys()).some(k=>!keys.includes(k)))
    return Response.json({error:"Invalid request"},{status:400,headers:manualHeaders});
  const [classId,sessionId,termId,subjectId]=keys.map(k=>query.get(k)??"");
  const {schoolId}=await params;
  const gradebook=await readInternalReviewedManualGradebook(
   schoolId,sessionId,termId,classId,subjectId);
  return Response.json({gradebook},{headers:manualHeaders});
 }catch(error){return manualError(error);}
}

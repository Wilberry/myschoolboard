import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AssessmentManualCorrectionReviewWorkspace } from "@/src/components/assessment-manual-correction-review-workspace";
export default async function ManualCorrectionReviewPage({params}:
 {params:Promise<{schoolId:string}>}){
 const session=await auth.api.getSession({headers:await headers()});
 if(!session)redirect("/");
 const {schoolId}=await params;
 const reviewer=await prisma.membership.findFirst({
  where:{schoolId,userId:session.user.id,isActive:true,
   role:{in:["HEAD_OF_SECTION","PRINCIPAL"]},
   school:{isActive:true},
   scopes:{some:{type:"SECTION",verified:true}}},
  select:{id:true},
 });
 if(!reviewer)notFound();
 return <main className="workspace">
  <header className="topbar">
   <Link className="brand" href="/">MySchoolBoard</Link>
   <Link href={`/schools/${schoolId}`}>Back to school</Link>
  </header>
  <section className="workspace-content">
   <p className="eyebrow">PHASE 7 / VERIFIED SECTION ACADEMIC REVIEW</p>
   <h1>Review manual mark corrections</h1>
   <AssessmentManualCorrectionReviewWorkspace schoolId={schoolId}/>
  </section>
 </main>;
}

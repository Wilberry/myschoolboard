import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AssessmentManualCorrectionWorkspace } from "@/src/components/assessment-manual-correction-workspace";
export default async function ManualCorrectionPage({params}:
 {params:Promise<{schoolId:string}>}) {
 const session=await auth.api.getSession({headers:await headers()});
 if(!session)redirect("/");
 const {schoolId}=await params;
 const member=await prisma.membership.findFirst({
  where:{schoolId,userId:session.user.id,isActive:true,role:"TEACHER",
   school:{isActive:true},
   teacherClassSubjectAssignments:{some:{status:"ACTIVE",sessionId:{not:null}}}},
  select:{id:true},
 });
 if(!member)notFound();
 return <main className="workspace">
  <header className="topbar">
   <Link className="brand" href="/">MySchoolBoard</Link>
   <Link href={`/schools/${schoolId}`}>Back to school</Link>
  </header>
  <section className="workspace-content">
   <p className="eyebrow">PHASE 7 / TEACHER PRIVATE AUDIT</p>
   <h1>Manual mark correction requests</h1>
   <AssessmentManualCorrectionWorkspace schoolId={schoolId}/>
  </section>
 </main>;
}

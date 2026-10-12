import {headers} from "next/headers";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {auth} from "@/src/lib/auth";
import {readLessonWritingOptions} from "@/src/modules/lesson-notes/read-options";
import {AssessmentReviewedManualGradebookWorkspace} from "@/src/components/assessment-reviewed-manual-gradebook-workspace";
export default async function ReviewedManualGradebookPage({params}:
 {params:Promise<{schoolId:string}>}){
 const session=await auth.api.getSession({headers:await headers()});
 if(!session)redirect("/");
 const {schoolId}=await params;
 const options=await readLessonWritingOptions(session.user.id,schoolId);
 if(!options||!options.assignments.length)notFound();
 return <main className="workspace">
  <header className="topbar"><Link className="brand" href="/">MySchoolBoard</Link>
   <Link href={`/schools/${schoolId}`}>Back to school</Link></header>
  <section className="workspace-content">
   <p className="eyebrow">PHASE 7 / TEACHER ACADEMIC APPROVAL PREVIEW</p>
   <h1>Reviewed written marks</h1>
   <p className="lede">{options.school.name}</p>
   <AssessmentReviewedManualGradebookWorkspace schoolId={schoolId} options={options}/>
  </section>
 </main>;
}

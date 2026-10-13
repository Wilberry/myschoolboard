import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { ResultSheetEvidenceWorkspace } from "@/src/components/result-sheet-evidence-workspace";
export default async function ResultEvidencePage({
 params,
}: { params: Promise<{ schoolId: string }> }) {
 const session = await auth.api.getSession({ headers: await headers() });
 if (!session) redirect("/");
 const { schoolId } = await params;
 const options = await readLessonWritingOptions(session.user.id, schoolId);
 if (!options || !options.assignments.length) notFound();
 return <main className="workspace">
  <header className="topbar">
   <Link className="brand" href="/">MySchoolBoard</Link>
   <Link href={`/schools/${schoolId}`}>Back to school</Link>
  </header>
  <section className="workspace-content">
   <p className="eyebrow">PHASE 8 / TEACHER RESULT EVIDENCE</p>
   <h1>Prepare immutable academic evidence</h1>
   <ResultSheetEvidenceWorkspace schoolId={schoolId} options={options} />
  </section>
 </main>;
}

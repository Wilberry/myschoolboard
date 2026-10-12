import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { SchemeOfWorkEditor } from "@/src/components/scheme-of-work-editor";

export default async function SchemesOfWorkPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readLessonWritingOptions(session.user.id, schoolId);
  if (!options) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link className="brand" href="/">MySchoolBoard</Link>
      <Link className="secondary-link" href={`/schools/${schoolId}`}>Back to school</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">TEACHER ACADEMIC PLANNING</p>
      <h1>Schemes of work</h1>
      <p>Plan weekly topics for your verified class, subject and term. Submitted plans need HM/Principal review and separate release before verified students can read them.</p>
      <SchemeOfWorkEditor schoolId={schoolId} options={options} />
    </section>
  </main>;
}

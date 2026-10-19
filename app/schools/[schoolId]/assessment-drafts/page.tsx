import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { AssessmentDraftEditor } from "@/src/components/assessment-draft-editor";

interface AssessmentDraftPageProps {
  params: Promise<{ schoolId: string }>;
}

export default function AssessmentDraftPage({ params }: AssessmentDraftPageProps) {
  return (
    <main className="workspace">
      <Suspense
        fallback={
          <p className="workspace-note" role="status">
            Checking assessment draft access…
          </p>
        }
      >
        <AuthorizedAssessmentDraft params={params} />
      </Suspense>
    </main>
  );
}

async function AuthorizedAssessmentDraft({ params }: AssessmentDraftPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readLessonWritingOptions(session.user.id, schoolId);
  if (!options || !options.assignments.length) notFound();
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 7 / TEACHER DEVELOPMENT</p>
        <h1>Assessment draft configuration</h1>
        <p className="lede">{options.school.name}</p>
        <AssessmentDraftEditor schoolId={schoolId} options={options} />
      </section>
    </>
  );
}

import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { AssessmentClassRecordWorkspace } from "@/src/components/assessment-class-record-workspace";

interface ClassRecordsPageProps {
  params: Promise<{ schoolId: string }>;
}

export default function ClassRecordsPage({ params }: ClassRecordsPageProps) {
  return (
    <main className="workspace">
      <Suspense
        fallback={
          <p className="workspace-note" role="status">
            Checking class record access…
          </p>
        }
      >
        <AuthorizedClassRecords params={params} />
      </Suspense>
    </main>
  );
}

async function AuthorizedClassRecords({ params }: ClassRecordsPageProps) {
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
        <p className="eyebrow">PHASE 7 / PRIVATE TEACHER PREVIEW</p>
        <h1>Class record sheets</h1>
        <p className="lede">{options.school.name}</p>
        <AssessmentClassRecordWorkspace schoolId={schoolId} options={options} />
      </section>
    </>
  );
}

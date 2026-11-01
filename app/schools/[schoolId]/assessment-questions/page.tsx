import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { AssessmentQuestionEditor } from "@/src/components/assessment-question-editor";

export default async function TeacherQuestionBankPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readLessonWritingOptions(session.user.id, schoolId);
  if (!options || options.assignments.length === 0) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link className="secondary-link" href={`/schools/${schoolId}`}>
          Back to school
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 7 / ASSIGNED TEACHER</p>
        <h1>Assessment question bank</h1>
        <p className="lede">{options.school.name}</p>
        <AssessmentQuestionEditor schoolId={schoolId} options={options} />
      </section>
    </main>
  );
}

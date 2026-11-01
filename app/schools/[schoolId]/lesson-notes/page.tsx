import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readLessonWritingOptions } from "@/src/modules/lesson-notes/read-options";
import { LessonNoteEditor } from "@/src/components/lesson-note-editor";

export default async function TeacherLessonNotesPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readLessonWritingOptions(session.user.id, schoolId);
  if (!options) notFound();

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <Link className="secondary-link" href="/">
          Back to workspace
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">TEACHER / LESSON PLANNING</p>
        <h1>My lesson notes</h1>
        <p className="lede">{options.school.name}</p>
        <LessonNoteEditor schoolId={schoolId} options={options} />
      </section>
    </main>
  );
}

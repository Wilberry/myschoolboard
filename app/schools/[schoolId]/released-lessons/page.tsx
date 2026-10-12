import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readReleasedLessonsForStudent } from "@/src/modules/lesson-notes/student-release-read";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";

export default async function ReleasedLessonsPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  let lessons: Awaited<ReturnType<typeof readReleasedLessonsForStudent>>;
  try {
    lessons = await readReleasedLessonsForStudent(schoolId);
  } catch (error) {
    if (error instanceof LessonNoteError &&
        (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }
  return <main className="workspace">
    <header className="topbar">
      <Link href="/" className="brand">MySchoolBoard</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">STUDENT WORKSPACE</p>
      <h1>Released lesson notes</h1>
      <p>Only notes approved and released for your verified active class and academic period are shown.</p>
      {lessons.length === 0 && <p>No released lessons are available for this class and term.</p>}
      {lessons.map(note => <article className="school-card" key={note.id}>
        <h2>{note.topic}</h2>
        <p>{note.className} · {note.subjectName} · {note.termName}</p>
        <h3>Objectives</h3><p style={{ whiteSpace: "pre-wrap" }}>{note.objectives}</p>
        <h3>Lesson content</h3><p style={{ whiteSpace: "pre-wrap" }}>{note.content}</p>
      </article>)}
    </section>
  </main>;
}

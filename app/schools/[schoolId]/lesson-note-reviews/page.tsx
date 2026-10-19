import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";
import { readSubmittedLessonNotes } from "@/src/modules/lesson-notes/review-service";
import { LessonReviewWorkspace } from "@/src/components/lesson-review-workspace";

export default async function LessonReviewPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;

  let notes;
  try {
    notes = await readSubmittedLessonNotes(schoolId);
  } catch (error) {
    if (error instanceof LessonNoteError &&
      (error.code === "FORBIDDEN" ||
       error.code === "NOT_FOUND" ||
       error.code === "INVALID_INPUT")) {
      notFound();
    }
    throw error;
  }

  const pending = notes.map((note) => ({
    id: note.id,
    topic: note.topic,
    kind: note.kind,
    weekStart: note.weekStart,
    weekEnd: note.weekEnd,
    classId: note.classId,
    className: note.className,
    sectionName: note.sectionName,
    subjectName: note.subjectName,
    currentRevision: note.currentRevision,
    submittedAt: note.submittedAt.toISOString(),
  }));

  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <Link href={`/schools/${schoolId}`} className="secondary-link">
          Back to school
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">SECTION ACADEMIC REVIEW</p>
        <h1>Submitted lesson notes</h1>
        <p className="lede">
          Review notes only for your verified primary or secondary section.
          Approval is not student publication.
        </p>
        <LessonReviewWorkspace schoolId={schoolId} initialNotes={pending} />
      </section>
    </main>
  );
}

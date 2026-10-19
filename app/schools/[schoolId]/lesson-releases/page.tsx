import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { hasLessonReviewWorkspace } from "@/src/modules/lesson-notes/review-navigation";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import { LessonReleaseEditor } from "@/src/components/lesson-release-editor";

export default async function LessonReleasePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const principal = await resolveSchoolPrincipal(session.user.id, schoolId);
  if (!(await hasLessonReviewWorkspace(principal))) notFound();
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
        <p className="eyebrow">ACADEMIC SECTION REVIEW</p>
        <h1>Approved lesson release</h1>
        <p>
          Only an explicitly released approved revision may later be made
          visible to verified students of its class and term.
        </p>
        <LessonReleaseEditor schoolId={schoolId} />
      </section>
    </main>
  );
}

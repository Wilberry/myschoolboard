import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import { hasLessonReviewWorkspace } from "@/src/modules/lesson-notes/review-navigation";
import { AssessmentReviewEditor } from "@/src/components/assessment-review-editor";

interface AssessmentReviewsPageProps {
  params: Promise<{ schoolId: string }>;
}

export default function AssessmentReviewsPage({
  params,
}: AssessmentReviewsPageProps) {
  return (
    <main className="workspace">
      <Suspense
        fallback={
          <p className="workspace-note" role="status">
            Checking assessment review access…
          </p>
        }
      >
        <AuthorizedAssessmentReview params={params} />
      </Suspense>
    </main>
  );
}

async function AuthorizedAssessmentReview({
  params,
}: AssessmentReviewsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const principal = await resolveSchoolPrincipal(session.user.id, schoolId);
  if (!(await hasLessonReviewWorkspace(principal))) notFound();
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 7 / EXACT SECTION REVIEW</p>
        <h1>Assessment configuration review</h1>
        <AssessmentReviewEditor schoolId={schoolId} />
      </section>
    </>
  );
}

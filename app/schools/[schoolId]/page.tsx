import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/src/lib/auth";
import { requireSchoolAccess } from "@/src/modules/tenancy/school-access";
import { authorize } from "@/src/modules/authorization/policy";
import { hasLessonReviewWorkspace } from "@/src/modules/lesson-notes/review-navigation";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  return (
    <Suspense fallback={<SchoolDetailFallback />}>
      <SchoolDetailContent params={params} />
    </Suspense>
  );
}

async function SchoolDetailContent({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const { schoolId } = await params;
  const access = await requireSchoolAccess(session.user.id, schoolId);

  if (!access) {
    notFound();
  }
  const canReviewLessonNotes = await hasLessonReviewWorkspace(access.principal);

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
      </header>

      <section
        className="workspace-content"
        aria-labelledby="school-detail-heading"
      >
        <div className="workspace-heading-row">
          <div>
            <p className="eyebrow">SCHOOL ACCESS</p>
            <h1 id="school-detail-heading">{access.school.name}</h1>
          </div>
          <Link href="/" className="secondary-link">
            Back to workspace
          </Link>
        </div>

        {access.principal.membership?.role === "SCHOOL_SUPER_ADMIN" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-grading-policies`} className="secondary-link">
              Grading policy drafts (development)
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "SCHOOL_SUPER_ADMIN" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-publications`} className="secondary-link">
              Assessment publication ledger (development)
            </Link>
          </p>
        )}
        {authorize(access.principal, "school:configure", { schoolId }).allowed && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/setup`} className="secondary-link">
              Configure academic structure
            </Link>
          </p>
        )}
        {authorize(access.principal, "school:configure", { schoolId }).allowed && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/students`} className="secondary-link">
              Manage students and enrollment
            </Link>
          </p>
        )}
        {authorize(access.principal, "school:configure", { schoolId }).allowed && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/student-links`} className="secondary-link">
              Verify student account identity
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "STUDENT" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/my-lessons`} className="secondary-link">
              My released lessons and schemes of work
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "TEACHER" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-manual-marks`} className="secondary-link">
              Written assessment mark proposals (development)
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "TEACHER" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-marking`} className="secondary-link">
              Mark submitted objective assessments (development)
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "TEACHER" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-class-records`} className="secondary-link">
              Provisional class record sheets (development)
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "TEACHER" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-drafts`} className="secondary-link">
              Configure assessment drafts (development)
            </Link>
          </p>
        )}
        {access.principal.membership?.role === "TEACHER" && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-questions`} className="secondary-link">
              My assessment question bank (development)
            </Link>
          </p>
        )}
        {(access.principal.membership?.role === "TEACHER" ||
          access.principal.membership?.role === "FORM_TEACHER") && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/attendance`} className="secondary-link">
              Take class attendance (Form Teacher)
            </Link>
          </p>
        )}
        {(access.principal.membership?.role === "FORM_TEACHER" ||
          access.principal.membership?.role === "TEACHER") && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/attendance-corrections`} className="secondary-link">
              Request attendance correction
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-manual-reviews`} className="secondary-link">
              Review initial manual assessment marks (development)
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/assessment-reviews`} className="secondary-link">
              Review assessment configurations (development)
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/lesson-releases`} className="secondary-link">
              Manage approved lesson releases
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/attendance-correction-reviews`} className="secondary-link">
              Review attendance corrections
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/attendance-reviews`} className="secondary-link">
              Review section attendance
            </Link>
          </p>
        )}
        {canReviewLessonNotes && (
          <p className="setup-navigation">
            <Link href={`/schools/${schoolId}/lesson-note-reviews`} className="secondary-link">
              Review submitted lesson notes
            </Link>
          </p>
        )}
        <div className="school-card">
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{access.school.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{access.school.slug}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {access.principal.membership?.role.replaceAll("_", " ") ??
                  "Member"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

function SchoolDetailFallback() {
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
      </header>
      <section className="workspace-content" aria-live="polite">
        <p className="eyebrow">SCHOOL ACCESS</p>
        <h1>Loading school details…</h1>
      </section>
    </main>
  );
}

import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readAttendanceReviewerOptions } from "@/src/modules/attendance/navigation";
import { AttendanceCorrectionReviewEditor } from "@/src/components/attendance-correction-review-editor";

interface AttendanceCorrectionReviewPageProps {
  params: Promise<{ schoolId: string }>;
}

export default function AttendanceCorrectionReviewPage({
  params,
}: AttendanceCorrectionReviewPageProps) {
  return (
    <main className="workspace">
      <Suspense
        fallback={
          <p className="workspace-note" role="status">
            Checking attendance review access…
          </p>
        }
      >
        <AuthorizedAttendanceCorrectionReview params={params} />
      </Suspense>
    </main>
  );
}

async function AuthorizedAttendanceCorrectionReview({
  params,
}: AttendanceCorrectionReviewPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const access = await readAttendanceReviewerOptions(session.user.id, schoolId);
  if (!access) notFound();
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link className="secondary-link" href={`/schools/${schoolId}`}>
          Back to school
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">SECTION REVIEW</p>
        <h1>Attendance correction reviews</h1>
        <p className="lede">
          {access.schoolName} · {access.sectionNames.join(", ")}
        </p>
        <p>
          Each correction is evaluated separately against the original approved
          mark and the requester’s explanation. Approvals are immutable.
        </p>
        <AttendanceCorrectionReviewEditor schoolId={schoolId} />
      </section>
    </>
  );
}

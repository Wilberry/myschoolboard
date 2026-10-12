import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readAttendanceReviewerOptions } from "@/src/modules/attendance/navigation";
import { AttendanceReviewEditor } from "@/src/components/attendance-review-editor";

export default async function AttendanceReviewPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readAttendanceReviewerOptions(session.user.id, schoolId);
  if (!options) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">MySchoolBoard</Link>
        <Link className="secondary-link" href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">ACADEMIC SECTION REVIEW</p>
        <h1>Pending attendance approvals</h1>
        <p className="lede">{options.schoolName} · {options.sectionNames.join(", ")}</p>
        <p>Review each submitted class roster before an official decision. Approved and returned snapshots remain immutable; a later correction requires an audit-preserving workflow.</p>
        <AttendanceReviewEditor schoolId={schoolId} />
      </section>
    </main>
  );
}

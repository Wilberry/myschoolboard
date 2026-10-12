import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readAttendancePolicyForAdmin } from "@/src/modules/attendance/policy-service";
import { AttendancePolicyEditor } from "@/src/components/attendance-policy-editor";
import { AttendanceDayEditor } from "@/src/components/attendance-day-editor";

export default async function AttendancePolicyPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const snapshot = await readAttendancePolicyForAdmin(session.user.id, schoolId);
  if (!snapshot) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">MySchoolBoard</Link>
        <Link className="secondary-link" href={`/schools/${schoolId}/setup`}>
          Back to academic setup
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">SCHOOL ADMINISTRATION</p>
        <h1>Attendance date and correction policy</h1>
        <p className="lede">{snapshot.school.name}</p>
        <p>Changes create permanent policy revisions. Previously submitted attendance and approval history are not modified. Dates remain restricted to the UTC day or earlier until full timezone-policy verification.</p>
        <AttendancePolicyEditor schoolId={schoolId} current={snapshot.current} />
        <AttendanceDayEditor schoolId={schoolId} recent={snapshot.recentTeachingDays} />
      </section>
    </main>
  );
}

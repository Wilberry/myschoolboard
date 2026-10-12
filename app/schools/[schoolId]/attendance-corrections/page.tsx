import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readFormTeacherAttendanceOptions } from "@/src/modules/attendance/navigation";
import { AttendanceCorrectionEditor } from "@/src/components/attendance-correction-editor";

export default async function AttendanceCorrectionsPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const access = await readFormTeacherAttendanceOptions(session.user.id, schoolId);
  if (!access) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">MySchoolBoard</Link>
        <Link className="secondary-link" href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">FORM TEACHER</p>
        <h1>Request attendance correction</h1>
        <p className="lede">{access.schoolName}</p>
        <p>Original approved marks remain unchanged. A proposed replacement needs a reason and independent section approval. Only current authorized classes and active sessions can be corrected.</p>
        <AttendanceCorrectionEditor schoolId={schoolId} />
      </section>
    </main>
  );
}

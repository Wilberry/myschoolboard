import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readFormTeacherAttendanceOptions } from "@/src/modules/attendance/navigation";
import { AttendanceEntryEditor } from "@/src/components/attendance-entry-editor";

export default async function FormTeacherAttendancePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const options = await readFormTeacherAttendanceOptions(
    session.user.id,
    schoolId,
  );
  if (!options) notFound();
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
        <p className="eyebrow">FORM TEACHER</p>
        <h1>Class attendance</h1>
        <p className="lede">{options.schoolName}</p>
        <p>
          Select a class, explicitly mark every currently enrolled student and
          submit once for the selected UTC date. Published attendance
          corrections require a separate audited workflow.
        </p>
        <AttendanceEntryEditor schoolId={schoolId} classes={options.classes} />
      </section>
    </main>
  );
}

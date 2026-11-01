import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readTimetableSetup } from "@/src/modules/timetable/read-setup";
import { TimetableEditor } from "@/src/components/timetable-editor";

export default async function SchoolTimetablePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const snapshot = await readTimetableSetup(session.user.id, schoolId);
  if (!snapshot) notFound();

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <Link href={`/schools/${schoolId}/setup`} className="secondary-link">
          Back to academic setup
        </Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">SCHOOL ADMINISTRATION</p>
        <h1>Weekly timetable</h1>
        <p className="lede">{snapshot.school.name}</p>
        <TimetableEditor schoolId={schoolId} snapshot={snapshot} />
      </section>
    </main>
  );
}

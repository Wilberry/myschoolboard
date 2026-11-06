import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readSchoolSetup } from "@/src/modules/academics/read-setup";
import { SchoolSetupEditor } from "@/src/components/school-setup-editor";

export default async function SchoolSetupPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const snapshot = await readSchoolSetup(session.user.id, schoolId);
  if (!snapshot) notFound();

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <Link href={`/schools/${schoolId}`} className="secondary-link">
          Back to school
        </Link>
      </header>
      <section className="workspace-content">
        <div className="workspace-heading-row">
          <div>
            <p className="eyebrow">SCHOOL ADMINISTRATION</p>
            <h1>Academic setup</h1>
            <p className="lede">{snapshot.school.name}</p>
          </div>
          <Link
            href={`/schools/${schoolId}/timetable`}
            className="secondary-link"
          >
            Manage weekly timetable
          </Link>
        </div>
        <p className="setup-navigation">
          <Link
            href={`/schools/${schoolId}/attendance-policy`}
            className="secondary-link"
          >
            Configure school attendance calendar and correction windows
          </Link>
        </p>
        <SchoolSetupEditor schoolId={schoolId} snapshot={snapshot} />
      </section>
    </main>
  );
}

import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readStudentWorkspace } from "@/src/modules/students/read-workspace";
import { StudentWorkspaceEditor } from "@/src/components/student-workspace-editor";

export default async function StudentAdministrationPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const snapshot = await readStudentWorkspace(session.user.id, schoolId);
  if (!snapshot) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">MySchoolBoard</Link>
        <Link className="secondary-link" href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">SCHOOL ADMINISTRATION</p>
        <h1>Student records and enrollment</h1>
        <p className="lede">{snapshot.school.name}</p>
        <p>Private administrator workspace. Showing up to 50 students and 30 historical enrollments per student; no student or guardian accounts are created.</p>
        <p className="setup-navigation">
          <Link href={`/schools/${schoolId}/student-identity`} className="secondary-link">
            Verify student login identity before released lesson access
          </Link>
        </p>
        <StudentWorkspaceEditor schoolId={schoolId} snapshot={snapshot} />
      </section>
    </main>
  );
}

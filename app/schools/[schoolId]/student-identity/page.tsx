import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readSchoolSetup } from "@/src/modules/academics/read-setup";
import { StudentIdentityLinkEditor } from "@/src/components/student-identity-link-editor";

export default async function StudentIdentityAdminPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const school = await readSchoolSetup(session.user.id, schoolId);
  if (!school) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link className="brand" href="/">MySchoolBoard</Link>
      <Link className="secondary-link" href={`/schools/${schoolId}/students`}>Back to students</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">SCHOOL ADMINISTRATION</p>
      <h1>Verify student account ownership</h1>
      <p className="lede">{school.school.name}</p>
      <StudentIdentityLinkEditor schoolId={schoolId} />
    </section>
  </main>;
}

import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import { authorize } from "@/src/modules/authorization/policy";
import { StudentAccountLinkEditor } from "@/src/components/student-account-link-editor";
export default async function SchoolStudentLinksPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const principal = await resolveSchoolPrincipal(session.user.id, schoolId);
  if (!authorize(principal, "school:configure", { schoolId }).allowed) notFound();
  return <main className="workspace"><header className="topbar">
    <Link className="brand" href="/">MySchoolBoard</Link>
    <Link href={`/schools/${schoolId}/students`}>Back to student records</Link>
    </header><section className="workspace-content">
    <p className="eyebrow">SCHOOL ADMINISTRATION</p>
    <h1>Verify student account ownership</h1>
    <StudentAccountLinkEditor schoolId={schoolId} />
  </section></main>;
}

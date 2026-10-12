import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AssessmentPublicationEditor } from "@/src/components/assessment-publication-editor";

export default async function AssessmentPublicationPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const actor = await prisma.membership.findFirst({
    where: {
      schoolId, userId: session.user.id,
      role: "SCHOOL_SUPER_ADMIN", isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!actor) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link className="brand" href="/">MySchoolBoard</Link>
      <Link href={`/schools/${schoolId}`}>Back to school</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">SCHOOL SUPER ADMIN / PHASE 7 DEVELOPMENT</p>
      <h1>Approved assessment publication controls</h1>
      <AssessmentPublicationEditor schoolId={schoolId} />
    </section>
  </main>;
}

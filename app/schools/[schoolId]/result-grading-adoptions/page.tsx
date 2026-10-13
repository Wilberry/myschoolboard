import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { ResultGradingAdoptionWorkspace } from "@/src/components/result-grading-adoption-workspace";

export default async function ResultGradingAdoptionsPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId: session.user.id,
      isActive: true, role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true } },
    select: { id: true },
  });
  if (!owner) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link className="brand" href="/">MySchoolBoard</Link>
      <Link href={`/schools/${schoolId}`}>Back to school</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">PHASE 8 / SCHOOL POLICY ADOPTION</p>
      <h1>Adopt school grading rules</h1>
      <ResultGradingAdoptionWorkspace schoolId={schoolId} />
    </section>
  </main>;
}

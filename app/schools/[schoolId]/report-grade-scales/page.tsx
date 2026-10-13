import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { ReportGradeScaleWorkspace } from "@/src/components/report-grade-scale-workspace";

export default async function ReportGradeScalePage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId: session.user.id,
      isActive: true, role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true } }, select: { id: true },
  });
  if (!owner) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link className="brand" href="/">MySchoolBoard</Link>
      <Link href={`/schools/${schoolId}`}>Back to school</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">PHASE 8 / SCHOOL-GOVERNED GRADE LABELS</p>
      <h1>Adopt a report grading scale</h1>
      <ReportGradeScaleWorkspace schoolId={schoolId} />
    </section>
  </main>;
}

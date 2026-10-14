import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { PublishedReportWorkspace } from "@/src/components/published-report-workspace";
export const dynamic = "force-dynamic";
export default async function PublishedReportsPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const eligible = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId: session.user.id,
      isActive: true,
      role: { in: ["PARENT", "STUDENT"] },
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!eligible) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/" className="brand">
          MySchoolBoard
        </Link>
        <Link href="/">Back to my schools</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 8 / AUTHORIZED SCHOOL REPORTS</p>
        <h1>My officially released subjects</h1>
        <PublishedReportWorkspace schoolId={schoolId} />
      </section>
    </main>
  );
}

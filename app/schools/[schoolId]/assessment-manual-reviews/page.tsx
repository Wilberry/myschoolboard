import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AssessmentManualReviewWorkspace } from "@/src/components/assessment-manual-review-workspace";
export default async function ManualReviewPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const member = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId: session.user.id,
      isActive: true,
      role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
      school: { isActive: true },
      scopes: { some: { type: "SECTION", verified: true } },
    },
    select: { id: true },
  });
  if (!member) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 7 / VERIFIED ACADEMIC REVIEW</p>
        <h1>Manual mark approvals</h1>
        <AssessmentManualReviewWorkspace schoolId={schoolId} />
      </section>
    </main>
  );
}

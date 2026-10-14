import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { ResultSheetReviewWorkspace } from "@/src/components/result-sheet-review-workspace";
export default async function ResultSheetReviewPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const reviewer = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId: session.user.id,
      isActive: true,
      school: { isActive: true },
      role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
      scopes: { some: { type: "SECTION", verified: true } },
    },
    select: { id: true },
  });
  if (!reviewer) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 8 / INDEPENDENT ACADEMIC REVIEW</p>
        <h1>Review prepared result evidence</h1>
        <ResultSheetReviewWorkspace schoolId={schoolId} />
      </section>
    </main>
  );
}

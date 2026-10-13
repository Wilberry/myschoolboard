import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { PrivateTermGradePreviewWorkspace } from "@/src/components/private-term-grade-preview-workspace";

export default async function PrivateTermGradePreviewPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId, userId: session.user.id,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true, school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">MySchoolBoard</Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 8 / PRIVATE TERM PREVIEW</p>
        <h1>Review one pupil across assigned term subjects</h1>
        <PrivateTermGradePreviewWorkspace schoolId={schoolId} />
      </section>
    </main>
  );
}

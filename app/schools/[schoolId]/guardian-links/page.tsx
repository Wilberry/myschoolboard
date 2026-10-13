import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { GuardianLinkWorkspace } from "@/src/components/guardian-link-workspace";
export const dynamic = "force-dynamic";
export default async function GuardianLinksPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const admin = await prisma.membership.findFirst({
    where: {
      schoolId, userId: session.user.id, isActive: true,
      role: { in: ["SCHOOL_ADMIN","SCHOOL_SUPER_ADMIN"] },
      school: { isActive: true },
    }, select: { id: true },
  });
  if (!admin) notFound();
  return <main className="workspace">
    <header className="topbar">
      <Link href="/" className="brand">MySchoolBoard</Link>
      <Link href={`/schools/${schoolId}`}>Back to school</Link>
    </header>
    <section className="workspace-content">
      <p className="eyebrow">PHASE 8 / VERIFIED GUARDIAN RELATIONSHIPS</p>
      <h1>Verify and audit guardian-to-pupil links</h1>
      <GuardianLinkWorkspace schoolId={schoolId} />
    </section>
  </main>;
}

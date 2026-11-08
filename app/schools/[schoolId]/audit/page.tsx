import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { SignOutButton } from "@/src/components/sign-out-button";
import { SchoolAuditWorkspace } from "@/src/components/school-audit-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  if (
    process.env.PHASE10_AUDIT_ENABLED !== "true" ||
    !(await prisma.membership.findFirst({
      where: {
        schoolId,
        userId: session.user.id,
        role: "SCHOOL_SUPER_ADMIN",
        isActive: true,
        school: { isActive: true },
      },
      select: { id: true },
    }))
  )
    notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/">MySchoolBoard</Link>
        <SignOutButton />
      </header>
      <div className="workspace-content">
        <h1>School audit evidence</h1>
        <SchoolAuditWorkspace schoolId={schoolId} />
      </div>
    </main>
  );
}

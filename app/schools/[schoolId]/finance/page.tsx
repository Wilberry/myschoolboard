import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { SignOutButton } from "@/src/components/sign-out-button";
import { SchoolFinanceWorkspace } from "@/src/components/finance-workspace";
export default async function FinancialPage({
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
      role: { in: ["SCHOOL_SUPER_ADMIN", "SCHOOL_ADMIN"] },
      school: { isActive: true },
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
        <SignOutButton />
      </header>
      <section className="workspace-content">
        <h1>Fees and payments</h1>
        <SchoolFinanceWorkspace schoolId={schoolId} />
      </section>
    </main>
  );
}

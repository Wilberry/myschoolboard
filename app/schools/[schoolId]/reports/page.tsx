import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { SignOutButton } from "@/src/components/sign-out-button";
import { PublishedReportsWorkspace } from "@/src/components/published-reports-workspace";
export default async function ReportsPage({
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
      role: { in: ["PARENT", "STUDENT"] },
      school: { isActive: true },
    },
    select: { role: true },
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
        <h1>Report cards</h1>
        <p className="lede">
          Published academic reports available under your school’s visibility
          policy.
        </p>
        <PublishedReportsWorkspace
          schoolId={schoolId}
          guardian={member.role === "PARENT"}
        />
      </section>
    </main>
  );
}

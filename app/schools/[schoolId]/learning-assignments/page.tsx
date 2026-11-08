import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LearningAssignmentWorkspace } from "@/src/components/learning-assignment-workspace";
import { SignOutButton } from "@/src/components/sign-out-button";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ releaseId?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const { releaseId } = await searchParams;
  if (
    !(await prisma.membership.findFirst({
      where: {
        schoolId,
        userId: session.user.id,
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
        <h1>Learning assignments</h1>
        <LearningAssignmentWorkspace
          schoolId={schoolId}
          releaseId={releaseId}
        />
      </div>
    </main>
  );
}

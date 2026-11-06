import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { TrashWorkspace } from "@/src/components/trash-workspace";
import { SignOutButton } from "@/src/components/sign-out-button";
export default async function Page({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  if (
    !(await prisma.membership.findFirst({
      where: {
        schoolId,
        userId: session.user.id,
        isActive: true,
        role: { in: ["SCHOOL_SUPER_ADMIN", "TEACHER"] },
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
        <h1>Trash and recovery</h1>
        <TrashWorkspace schoolId={schoolId} />
      </div>
    </main>
  );
}

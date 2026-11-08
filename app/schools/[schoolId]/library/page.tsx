import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LibraryWorkspace } from "@/src/components/library-workspace";
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
        <h1>Approved library catalog</h1>
        <LibraryWorkspace schoolId={schoolId} />
      </div>
    </main>
  );
}

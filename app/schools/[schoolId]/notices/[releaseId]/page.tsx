import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { NoticeWorkspace } from "@/src/components/notice-workspace";
import { SignOutButton } from "@/src/components/sign-out-button";
import { validUuid } from "@/src/modules/communications/service";
export default async function Page({
  params,
}: {
  params: Promise<{ schoolId: string; releaseId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId, releaseId } = await params;
  try {
    validUuid(releaseId);
  } catch {
    notFound();
  }
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
        <Link href={`/schools/${schoolId}/notices`}>School notices</Link>
        <SignOutButton />
      </header>
      <div className="workspace-content">
        <h1>Released school notice</h1>
        <NoticeWorkspace schoolId={schoolId} releaseId={releaseId} />
      </div>
    </main>
  );
}

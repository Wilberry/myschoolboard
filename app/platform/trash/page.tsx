import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { TrashWorkspace } from "@/src/components/trash-workspace";
import { SignOutButton } from "@/src/components/sign-out-button";
async function Content() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (
    !(await prisma.user.findFirst({
      where: { id: session.user.id, platformRole: "SUPER_ADMIN" },
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
        <h1>Platform trash</h1>
        <TrashWorkspace />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main>
          <h1>Platform trash</h1>
          <p>Checking access…</p>
        </main>
      }
    >
      <Content />
    </Suspense>
  );
}

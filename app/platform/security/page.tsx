import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AccountSecurityWorkspace } from "@/src/components/account-security-workspace";
import { SignOutButton } from "@/src/components/sign-out-button";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="workspace">
          <p role="status">Checking account security access…</p>
        </main>
      }
    >
      <AuthorizedSecurityPage />
    </Suspense>
  );
}
async function AuthorizedSecurityPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (
    process.env.PHASE10_AUTH_SECURITY_ENABLED !== "true" ||
    (
      await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { platformRole: true },
      })
    )?.platformRole !== "SUPER_ADMIN"
  )
    notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/platform">Platform administration</Link>
        <SignOutButton />
      </header>
      <div className="workspace-content">
        <h1>Platform security evidence</h1>
        <AccountSecurityWorkspace platform />
      </div>
    </main>
  );
}

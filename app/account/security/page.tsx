import { SecurityNotificationInbox } from "@/src/components/security-notification-inbox";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
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
  if (process.env.PHASE10_AUTH_SECURITY_ENABLED !== "true") notFound();
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/">MySchoolBoard</Link>
        <SignOutButton />
      </header>
      <div className="workspace-content">
        <h1>Your account security</h1>
        <AccountSecurityWorkspace />
        {process.env.PHASE10_SECURITY_INAPP_ENABLED === "true" && (
          <SecurityNotificationInbox />
        )}
      </div>
    </main>
  );
}

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { SignOutButton } from "@/src/components/sign-out-button";
import { NotificationInbox } from "@/src/components/notification-inbox";
export default async function Page({
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
      school: { isActive: true },
    },
    select: { role: true },
  });
  if (!member || process.env.PHASE10_INAPP_ENABLED !== "true") notFound();
  const classes = [
    "STUDENT",
    "TEACHER",
    "FORM_TEACHER",
    "HEAD_OF_SECTION",
    "PRINCIPAL",
  ].includes(member.role);
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/">MySchoolBoard</Link>
        <SignOutButton />
      </header>
      <div className="workspace-content">
        <h1>In-app notifications</h1>
        <p>
          Every update and destination checks your current school access.
          Reading an alert does not acknowledge a report or approve a school
          record.
        </p>
        {process.env.PHASE10_NOTICES_ENABLED === "true" && (
          <NotificationInbox
            schoolId={schoolId}
            heading="Official school notices"
          />
        )}
        {classes &&
          process.env.PHASE10_CLASS_ANNOUNCEMENTS_ENABLED === "true" && (
            <NotificationInbox
              schoolId={schoolId}
              channel="class"
              heading="Class announcements"
            />
          )}
        {process.env.PHASE10_MODULE_INAPP_ENABLED === "true" && (
          <NotificationInbox
            schoolId={schoolId}
            channel="module"
            heading="School workflow updates"
          />
        )}
      </div>
    </main>
  );
}

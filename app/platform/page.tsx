import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { PlatformSubscriptionEditor } from "@/src/components/platform-subscription-editor";

// Operator pages cannot be statically cached or shared across user sessions.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PlatformAdministrationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  // Authorization and school identity projection are one serializable,
  // actor-row-locked operation; role revocation cannot race a later query.
  const schools = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User"
        WHERE "id" = ${session.user.id} FOR UPDATE`;
      const actor = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, platformRole: true },
      });
      if (
        !actor ||
        !authorize(
          { userId: actor.id, platformRole: actor.platformRole, membership: null },
          "platform:manage",
        ).allowed
      ) return null;
      return tx.school.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          lifecycleStatus: true,
          isActive: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 100,
      });
    },
    { isolationLevel: "Serializable" },
  );
  if (!schools) notFound();

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <Link className="secondary-link" href="/">Back to workspace</Link>
      </header>
      <section className="workspace-content" aria-labelledby="platform-heading">
        <p className="eyebrow">PLATFORM SUPER ADMIN / DEVELOPMENT</p>
        <h1 id="platform-heading">Plans and school subscriptions</h1>
        <p className="lede">
          Record immutable plan revisions and explicit subscription periods.
          This does not collect payments, enforce quotas or activate schools.
        </p>
        <PlatformSubscriptionEditor schools={schools} />
      </section>
    </main>
  );
}

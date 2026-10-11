import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/src/lib/auth";
import { requireSchoolAccess } from "@/src/modules/tenancy/school-access";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  return (
    <Suspense fallback={<SchoolDetailFallback />}>
      <SchoolDetailContent params={params} />
    </Suspense>
  );
}

async function SchoolDetailContent({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const { schoolId } = await params;
  const access = await requireSchoolAccess(session.user.id, schoolId);

  if (!access) {
    notFound();
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
      </header>

      <section
        className="workspace-content"
        aria-labelledby="school-detail-heading"
      >
        <div className="workspace-heading-row">
          <div>
            <p className="eyebrow">SCHOOL ACCESS</p>
            <h1 id="school-detail-heading">{access.school.name}</h1>
          </div>
          <Link href="/" className="secondary-link">
            Back to workspace
          </Link>
        </div>

        <div className="school-card">
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{access.school.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{access.school.slug}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {access.principal.membership?.role.replaceAll("_", " ") ??
                  "Member"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

function SchoolDetailFallback() {
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
      </header>
      <section className="workspace-content" aria-live="polite">
        <p className="eyebrow">SCHOOL ACCESS</p>
        <h1>Loading school details…</h1>
      </section>
    </main>
  );
}

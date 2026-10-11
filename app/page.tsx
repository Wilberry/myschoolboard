import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/src/components/sign-in-form";
import { SignOutButton } from "@/src/components/sign-out-button";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";

export default async function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <main className="login-page">
        <section className="login-panel" aria-labelledby="welcome-heading">
          <div className="brand-mark" aria-hidden="true">
            M
          </div>
          <p className="eyebrow">MYSCHOOLBOARD / LOCAL</p>
          <h1 id="welcome-heading">A calmer view of school life.</h1>
          <p className="lede">Sign in to continue to your school workspace.</p>
          <SignInForm />
          <p className="login-footnote">Local development environment</p>
        </section>
        <aside className="login-aside" aria-label="Product identity">
          <div className="aside-rule" />
          <p className="aside-kicker">CONNECTED BY DESIGN</p>
          <p className="aside-copy">
            One considered workspace for the people who keep a school moving.
          </p>
          <span className="aside-index">FOUNDATION / 01</span>
        </aside>
      </main>
    );
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      school: { isActive: true },
    },
    select: {
      role: true,
      school: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { school: { name: "asc" } },
  });

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MySchoolBoard home">
          <span className="brand-mark">M</span>
          <span>MySchoolBoard</span>
        </Link>
        <div className="account-menu">
          <span className="account-name">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <section
        className="workspace-content"
        aria-labelledby="workspace-heading"
      >
        <div className="workspace-heading-row">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1 id="workspace-heading">
              Good to see you, {session.user.name.split(" ")[0]}.
            </h1>
          </div>
          <span className="environment-tag">
            <span />
            LOCAL ENVIRONMENT
          </span>
        </div>
        <div className="section-heading">
          <h2>Schools</h2>
          <span>{memberships.length.toString().padStart(2, "0")}</span>
        </div>
        {memberships.length ? (
          <ul className="school-list">
            {memberships.map(({ school, role }) => (
              <li key={school.id}>
                <div className="school-monogram" aria-hidden="true">
                  {school.name.slice(0, 1)}
                </div>
                <div className="school-details">
                  <h3>{school.name}</h3>
                  <p>{role.replaceAll("_", " ")}</p>
                </div>
                <div className="school-meta">
                  <span className="school-slug">{school.slug}</span>
                  <Link href={`/schools/${school.id}`} className="school-link">
                    View details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">
              +
            </span>
            <h3>No school memberships yet</h3>
            <p>Your account is active, but no school has granted you access.</p>
          </div>
        )}
        <p className="workspace-note">
          School records are available only through an active membership.
        </p>
      </section>
    </main>
  );
}

function HomeFallback() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-live="polite">
        <div className="brand-mark" aria-hidden="true">
          M
        </div>
        <p className="eyebrow">MYSCHOOLBOARD / LOCAL</p>
        <h1>Loading your workspace…</h1>
      </section>
    </main>
  );
}

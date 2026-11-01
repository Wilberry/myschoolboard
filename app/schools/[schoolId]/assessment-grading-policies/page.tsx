import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AssessmentGradingPolicyEditor } from "@/src/components/assessment-grading-policy-editor";

export default async function GradingPoliciesPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const admin = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      schoolId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!admin) notFound();
  const [sessions, terms, classes, subjects] = await Promise.all([
    prisma.academicSession.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { id: true, name: true },
      take: 30,
      orderBy: { name: "asc" },
    }),
    prisma.academicTerm.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        session: { status: "ACTIVE" },
      },
      select: { id: true, sessionId: true, name: true },
      take: 100,
      orderBy: { startsOn: "desc" },
    }),
    prisma.schoolClass.findMany({
      where: {
        schoolId,
        isActive: true,
        section: { isActive: true },
      },
      select: { id: true, name: true },
      take: 200,
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      take: 200,
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          MySchoolBoard
        </Link>
        <Link href={`/schools/${schoolId}`}>Back to school</Link>
      </header>
      <section className="workspace-content">
        <p className="eyebrow">PHASE 7 / SCHOOL SUPER ADMIN DEVELOPMENT</p>
        <h1>Grading profile preview revisions</h1>
        <AssessmentGradingPolicyEditor
          schoolId={schoolId}
          sessions={sessions}
          terms={terms}
          classes={classes}
          subjects={subjects}
        />
      </section>
    </main>
  );
}

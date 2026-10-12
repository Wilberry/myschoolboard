import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { StudentLessonsEditor } from "@/src/components/student-lessons-editor";
export default async function MyLessonsPage({
  params,
}: { params: Promise<{ schoolId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { schoolId } = await params;
  const eligible = await prisma.membership.findFirst({
    where: {
      schoolId, userId: session.user.id, role: "STUDENT", isActive: true,
      school: { isActive: true },
      studentAccountLink: {
        revocation: null,
        student: { status: "ENROLLED", enrollments: {
          some: { schoolId, status: "ACTIVE" },
        } },
      },
    },
    select: { id: true },
  });
  if (!eligible) notFound();
  return <main className="workspace"><header className="topbar">
    <Link className="brand" href="/">MySchoolBoard</Link>
    <Link href={`/schools/${schoolId}`}>School home</Link></header>
    <section className="workspace-content"><p className="eyebrow">STUDENT</p>
      <h1>My released lessons</h1><StudentLessonsEditor schoolId={schoolId} />
    </section></main>;
}

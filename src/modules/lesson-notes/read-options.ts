import { prisma } from "@/src/lib/db";

export interface LessonWritingOptions {
  school: { id: string; name: string };
  terms: { id: string; sessionId: string; name: string }[];
  assignments: {
    id: string;
    sessionId: string;
    label: string;
  }[];
}

/** Minimal form options scoped to the same authenticated TEACHER membership.
 * This does not create student, reviewer, or school-administration read rights.
 */
export async function readLessonWritingOptions(
  userId: string,
  schoolId: string,
): Promise<LessonWritingOptions | null> {
  if (!userId || !schoolId) return null;
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      isActive: true,
      memberships: {
        some: {
          userId,
          isActive: true,
          role: "TEACHER",
        },
      },
    },
    select: { id: true, name: true },
  });
  if (!school) return null;

  const schoolScope = {
    schoolId,
    school: {
      isActive: true,
      memberships: {
        some: {
          userId,
          isActive: true,
          role: "TEACHER" as const,
        },
      },
    },
  };
  const [assignments, terms] = await Promise.all([
    prisma.teacherClassSubjectAssignment.findMany({
      where: {
        ...schoolScope,
        membership: {
          userId,
          isActive: true,
          role: "TEACHER",
        },
        status: "ACTIVE",
        sessionId: { not: null },
        academicSession: { status: "ACTIVE" },
        schoolClass: { isActive: true },
        subject: { isActive: true },
      },
      select: {
        id: true,
        sessionId: true,
        schoolClass: { select: { name: true } },
        subject: { select: { name: true } },
      },
      take: 200,
      orderBy: { id: "asc" },
    }),
    prisma.academicTerm.findMany({
      where: {
        ...schoolScope,
        status: "ACTIVE",
        session: {
          status: "ACTIVE",
          teacherAssignments: {
            some: {
              schoolId,
              status: "ACTIVE",
              membership: {
                userId,
                role: "TEACHER",
                isActive: true,
              },
              schoolClass: { isActive: true },
              subject: { isActive: true },
            },
          },
        },
      },
      select: {
        id: true,
        sessionId: true,
        name: true,
        session: { select: { name: true } },
      },
      take: 100,
      orderBy: [{ startsOn: "desc" }, { id: "asc" }],
    }),
  ]);

  return {
    school,
    assignments: assignments.flatMap((assignment) =>
      assignment.sessionId
        ? [{
            id: assignment.id,
            sessionId: assignment.sessionId,
            label: `${assignment.schoolClass.name} · ${assignment.subject.name}`,
          }]
        : [],
    ),
    terms: terms.map((term) => ({
      id: term.id,
      sessionId: term.sessionId,
      name: `${term.session.name} · ${term.name}`,
    })),
  };
}

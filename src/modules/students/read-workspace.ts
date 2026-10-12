import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

/** Private school-administrator view. No teacher, guardian or platform override. */
export async function readStudentWorkspace(userId: string, schoolId: string) {
  if (!userId || !schoolId) return null;
  const principal = await resolveSchoolPrincipal(userId, schoolId);
  if (!principal?.membership ||
      !authorize(principal, "school:configure", { schoolId }).allowed) return null;

  // Repeat active tenant + exact administrator membership in EVERY final query.
  const scope = {
    schoolId,
    school: {
      isActive: true,
      memberships: {
        some: {
          userId,
          role: principal.membership.role,
          isActive: true,
        },
      },
    },
  };
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      isActive: true,
      memberships: { some: {
        userId, role: principal.membership.role, isActive: true,
      } },
    },
    select: { id: true, name: true },
  });
  if (!school) return null;

  const [students, sessions, classes] = await Promise.all([
    prisma.studentRecord.findMany({
      where: scope,
      select: {
        id: true, admissionNumber: true, givenName: true,
        familyName: true, status: true,
        enrollments: {
          where: { schoolId },
          select: {
            id: true, sessionId: true, classId: true,
            status: true, startedAt: true, endedAt: true,
          },
          take: 30,
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        },
      },
      take: 50,
      orderBy: [{ admissionNumber: "asc" }, { id: "asc" }],
    }),
    prisma.academicSession.findMany({
      where: { ...scope, status: "ACTIVE" },
      select: { id: true, name: true },
      take: 30,
      orderBy: { name: "asc" },
    }),
    prisma.schoolClass.findMany({
      where: {
        ...scope, isActive: true,
        section: { schoolId, isActive: true },
      },
      select: { id: true, name: true, section: { select: { name: true } } },
      take: 100,
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    school,
    students: students.map(student => ({
      ...student,
      enrollments: student.enrollments.map(enrollment => ({
        ...enrollment,
        startedAt: enrollment.startedAt.toISOString(),
        endedAt: enrollment.endedAt?.toISOString() ?? null,
      })),
    })),
    sessions,
    classes: classes.map(item => ({
      id: item.id, name: item.name,
      sectionName: item.section?.name ?? "",
    })),
  };
}

export type StudentWorkspaceSnapshot =
  NonNullable<Awaited<ReturnType<typeof readStudentWorkspace>>>;

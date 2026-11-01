import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

export interface TimetableSnapshot {
  school: { id: string; name: string };
  terms: { id: string; sessionId: string; label: string }[];
  rooms: { id: string; name: string }[];
  assignments: {
    id: string;
    sessionId: string;
    label: string;
  }[];
  slots: {
    id: string;
    termId: string;
    assignmentId: string;
    roomId: string | null;
    weekday: number;
    startMinute: number;
    endMinute: number;
  }[];
}

/** School administration only; final SQL rechecks active membership and role.
 * All collections are capped to avoid unbounded loads. The browser is only a
 * convenience UI; mutations separately reauthorize in serializable SQL.
 */
export async function readTimetableSetup(
  userId: string,
  schoolId: string,
): Promise<TimetableSnapshot | null> {
  if (!userId || !schoolId) return null;
  const principal = await resolveSchoolPrincipal(userId, schoolId);
  if (
    !authorize(principal, "school:configure", { schoolId }).allowed ||
    !principal?.membership
  ) {
    return null;
  }
  const allowed = {
    userId,
    isActive: true,
    role: principal.membership.role,
  };
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      isActive: true,
      memberships: { some: allowed },
    },
    select: { id: true, name: true },
  });
  if (!school) return null;
  const scoped = {
    schoolId,
    school: {
      isActive: true,
      memberships: { some: allowed },
    },
  };

  const [terms, rooms, assignments, slots] = await Promise.all([
    prisma.academicTerm.findMany({
      where: {
        ...scoped,
        status: "ACTIVE",
        session: { status: "ACTIVE" },
      },
      select: {
        id: true,
        sessionId: true,
        name: true,
        position: true,
        session: { select: { name: true } },
      },
      take: 100,
      orderBy: [{ startsOn: "desc" }, { position: "asc" }],
    }),
    prisma.timetableRoom.findMany({
      where: { ...scoped, isActive: true },
      select: { id: true, name: true },
      take: 100,
      orderBy: { name: "asc" },
    }),
    prisma.teacherClassSubjectAssignment.findMany({
      where: {
        ...scoped,
        status: "ACTIVE",
        sessionId: { not: null },
        academicSession: { status: "ACTIVE" },
        membership: { isActive: true, role: "TEACHER" },
        schoolClass: { isActive: true },
        subject: { isActive: true },
      },
      select: {
        id: true,
        sessionId: true,
        membership: {
          select: { user: { select: { name: true } } },
        },
        schoolClass: { select: { name: true } },
        subject: { select: { name: true } },
      },
      take: 200,
      orderBy: { id: "asc" },
    }),
    prisma.timetableSlot.findMany({
      where: {
        ...scoped,
        status: "ACTIVE",
        term: { status: "ACTIVE", session: { status: "ACTIVE" } },
      },
      select: {
        id: true,
        termId: true,
        assignmentId: true,
        roomId: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
      },
      take: 200,
      orderBy: [
        { termId: "asc" },
        { weekday: "asc" },
        { startMinute: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  return {
    school,
    terms: terms.map((term) => ({
      id: term.id,
      sessionId: term.sessionId,
      label: `${term.session.name} · ${term.name} (${term.position})`,
    })),
    rooms,
    assignments: assignments.flatMap((assignment) =>
      assignment.sessionId
        ? [
            {
              id: assignment.id,
              sessionId: assignment.sessionId,
              label: `${assignment.schoolClass.name} · ${assignment.subject.name} · ${assignment.membership.user.name}`,
            },
          ]
        : [],
    ),
    slots,
  };
}

import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

export interface SetupSnapshot {
  school: { id: string; name: string };
  sessions: {
    id: string;
    name: string;
    status: string;
    startsOn: string;
    endsOn: string;
  }[];
  terms: {
    id: string;
    sessionId: string;
    name: string;
    position: number;
    status: string;
    startsOn: string;
    endsOn: string;
  }[];
  classes: { id: string; name: string; isActive: boolean }[];
  subjects: { id: string; name: string; isActive: boolean }[];
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * This is a school-administration summary, not a teacher/student API. Every
 * collection query repeats the actor's active membership in the requested
 * school, so the initial principal resolution is not the sole read barrier.
 */
export async function readSchoolSetup(
  userId: string,
  schoolId: string,
): Promise<SetupSnapshot | null> {
  if (!userId || !schoolId) return null;
  const principal = await resolveSchoolPrincipal(userId, schoolId);
  if (
    !authorize(principal, "school:configure", { schoolId }).allowed ||
    !principal?.membership
  ) {
    return null;
  }
  const membershipWhere = {
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
      memberships: {
        some: {
          userId,
          role: principal.membership.role,
          isActive: true,
        },
      },
    },
    select: { id: true, name: true },
  });
  if (!school) return null;

  const [sessions, terms, classes, subjects] = await Promise.all([
    prisma.academicSession.findMany({
      where: membershipWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startsOn: true,
        endsOn: true,
      },
      take: 100,
      orderBy: [{ startsOn: "desc" }, { id: "asc" }],
    }),
    prisma.academicTerm.findMany({
      where: membershipWhere,
      select: {
        id: true,
        sessionId: true,
        name: true,
        position: true,
        status: true,
        startsOn: true,
        endsOn: true,
      },
      take: 100,
      orderBy: [{ startsOn: "desc" }, { position: "asc" }],
    }),
    prisma.schoolClass.findMany({
      where: membershipWhere,
      select: { id: true, name: true, isActive: true },
      take: 100,
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: membershipWhere,
      select: { id: true, name: true, isActive: true },
      take: 100,
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    school,
    sessions: sessions.map((item) => ({
      ...item,
      startsOn: dateOnly(item.startsOn),
      endsOn: dateOnly(item.endsOn),
    })),
    terms: terms.map((item) => ({
      ...item,
      startsOn: dateOnly(item.startsOn),
      endsOn: dateOnly(item.endsOn),
    })),
    classes,
    subjects,
  };
}

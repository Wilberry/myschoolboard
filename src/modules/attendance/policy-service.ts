import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError, requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import {
  DEFAULT_ATTENDANCE_DATE_POLICY, isSupportedTimeZone,
  type AttendanceDatePolicy,
} from "./school-date-policy";

const id = z.string().min(1).max(128).refine(v => v.trim() === v);
const revisionSchema = z.object({
  timeZone: z.string().min(3).max(64),
  submissionBackdateDays: z.number().int().min(0).max(30),
  correctionWindowDays: z.number().int().min(0).max(365),
  reason: z.string().trim().min(5).max(500),
}).strict();

export async function loadAttendanceDatePolicy(
  tx: Prisma.TransactionClient,
  schoolId: string,
): Promise<AttendanceDatePolicy> {
  const latest = await tx.schoolAttendancePolicyRevision.findFirst({
    where: { schoolId },
    orderBy: { revision: "desc" },
    select: {
      timeZone: true, submissionBackdateDays: true, correctionWindowDays: true,
    },
  });
  return latest ?? DEFAULT_ATTENDANCE_DATE_POLICY;
}

export async function changeAttendanceDatePolicy(schoolId: string, input: unknown) {
  if (!id.safeParse(schoolId).success) throw new AcademicConfigError("INVALID_INPUT");
  const parsed = revisionSchema.safeParse(input);
  if (!parsed.success || !isSupportedTimeZone(parsed.data.timeZone)) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AcademicConfigError("UNAUTHENTICATED");
  const userId = session.user.id;

  try {
    return await prisma.$transaction(async tx => {
      const actor = await requireSchoolConfigActor(tx, userId, schoolId);
      // Intl timezone aliases may not all exist in PostgreSQL. Require both
      // engines to recognize the exact same identifier before committing.
      const supported = await tx.$queryRaw<Array<{ found: boolean }>>(
        Prisma.sql`SELECT EXISTS(SELECT 1 FROM pg_timezone_names
          WHERE name = ${parsed.data.timeZone}) AS "found"`,
      );
      if (!supported[0]?.found) throw new AcademicConfigError("INVALID_INPUT");
      const previous = await tx.schoolAttendancePolicyRevision.findFirst({
        where: { schoolId },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      // The immutable row is simultaneously policy version and actor audit.
      // SQL trigger independently checks admin membership, timezone, revision.
      return await tx.schoolAttendancePolicyRevision.create({
        data: {
          schoolId, revision: (previous?.revision ?? 0) + 1,
          ...parsed.data, actorUserId: userId,
          actorMembershipId: actor.membershipId,
        },
        select: {
          id: true, revision: true, timeZone: true,
          submissionBackdateDays: true, correctionWindowDays: true,
          createdAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof AcademicConfigError) throw error;
    if (error && typeof error === "object" && "code" in error &&
        (error.code === "P2002" || error.code === "P2034")) {
      throw new AcademicConfigError("CONFLICT");
    }
    throw new AcademicConfigError("INTERNAL");
  }
}

/** Administrative read: currently active same-school school:configure grant
 * and repeat active membership inside final school-owned policy query. */
export async function readAttendancePolicyForAdmin(userId: string, schoolId: string) {
  if (!userId || !schoolId) return null;
  const principal = await resolveSchoolPrincipal(userId, schoolId);
  if (!principal?.membership ||
      !authorize(principal, "school:configure", { schoolId }).allowed) {
    return null;
  }
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId, isActive: true,
      memberships: { some: {
        userId, role: principal.membership.role, isActive: true,
      } },
    },
    select: {
      id: true, name: true,
      attendancePolicyRevisions: {
        take: 1, orderBy: { revision: "desc" },
        select: {
          revision: true, timeZone: true, submissionBackdateDays: true,
          correctionWindowDays: true, createdAt: true,
        },
      },
    },
  });
  if (!school) return null;
  const latest = school.attendancePolicyRevisions[0];
  return {
    school: { id: school.id, name: school.name },
    current: latest ?? { ...DEFAULT_ATTENDANCE_DATE_POLICY, revision: 0, createdAt: null },
  };
}

import { prisma } from "@/src/lib/db";
import {
  authorize,
  type AuthorizationPrincipal,
} from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "./context";

export interface SchoolAccessResult {
  principal: AuthorizationPrincipal;
  school: {
    id: string;
    name: string;
    slug: string;
  };
}

export async function requireSchoolAccess(
  userId: string | null | undefined,
  schoolId: string | null | undefined,
): Promise<SchoolAccessResult | null> {
  if (!userId || !schoolId) {
    return null;
  }

  const principal = await resolveSchoolPrincipal(userId, schoolId);
  const decision = authorize(principal, "academic:read", { schoolId });
  if (!decision.allowed || !principal?.membership) {
    return null;
  }

  const school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true },
    select: { id: true, name: true, slug: true },
  });

  if (!school) {
    return null;
  }

  return { principal, school };
}

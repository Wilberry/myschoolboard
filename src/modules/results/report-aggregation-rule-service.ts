import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "@/src/modules/assessments/question-service";

const identifier = z.string().min(1).max(128).refine(value => value.trim() === value);
const inputSchema = z.object({
  categoryMethod: z.enum(["EQUAL_ASSESSMENT_BPS", "POOLED_CATEGORY_POINTS"]),
  precisionMode: z.enum(["HALF_UP", "FLOOR", "CEILING"]),
  reason: z.string().trim().min(5).max(500),
}).strict();
function fail(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}
/** School owner explicitly adopts formula/precision for LATER report composition.
 * No student marks, reports, public result visibility or automatic defaults.
 */
export async function adoptSchoolReportAggregationRule(schoolId: string, input: unknown) {
  if (!identifier.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
          isActive: true, school: { isActive: true } },
        select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");
      return tx.reportAggregationRuleRevision.create({
        data: {
          id: randomUUID(), schoolId,
          categoryMethod: parsed.data.categoryMethod,
          precisionMode: parsed.data.precisionMode,
          reason: parsed.data.reason,
          actorMembershipId: owner.id,
          actorUserId: userId,
        },
        select: { id: true, version: true,
          categoryMethod: true, precisionMode: true,
          reason: true, adoptedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { fail(error); }
}

/** Bounded private policy history, still school-scoped within final SQL read. */
export async function listOwnReportAggregationRules(schoolId: string) {
  if (!identifier.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
      isActive: true, school: { isActive: true } }, select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; version: number; categoryMethod: string;
    precisionMode: string; reason: string; adoptedAt: Date;
  }>>(Prisma.sql`
    SELECT rule."id",rule."version",
      rule."categoryMethod",rule."precisionMode",
      rule."reason",rule."adoptedAt"
    FROM "ReportAggregationRuleRevision" rule
    JOIN "School" school ON school."id"=rule."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE rule."schoolId"=${schoolId}
    ORDER BY rule."version" DESC LIMIT 100
  `);
}

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";
import { validateReportGradeScale } from "./report-grade-scale";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim() === value);
const band = z
  .object({
    code: z.string().min(1).max(16),
    remark: z.string().min(1).max(120),
    minBps: z.number().int().min(0).max(10000),
    maxBps: z.number().int().min(0).max(10000),
  })
  .strict();
const inputSchema = z
  .object({
    bands: z.array(band).min(1).max(20),
    decimalPlaces: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    roundingMode: z.enum(["HALF_UP", "FLOOR", "CEILING"]),
    bandBasis: z.enum(["RAW_BPS", "DISPLAY_ROUNDED_BPS"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
function fail(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Owner explicitly adopts a complete, school-specific immutable grading
 * scale and rounding policy. It does NOT recalculate old source packets or
 * issue official grades, final result release or recipient access.
 */
export async function adoptSchoolReportGradeScale(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || !validateReportGradeScale(parsed.data))
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        const owner = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            isActive: true,
            role: "SCHOOL_SUPER_ADMIN",
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!owner) throw new AssessmentError("NOT_FOUND");
        return tx.reportGradeScaleRevision.create({
          data: {
            id: randomUUID(),
            schoolId,
            bands: parsed.data.bands,
            decimalPlaces: parsed.data.decimalPlaces,
            roundingMode: parsed.data.roundingMode,
            bandBasis: parsed.data.bandBasis,
            reason: parsed.data.reason,
            actorMembershipId: owner.id,
            actorUserId: userId,
          },
          select: {
            id: true,
            version: true,
            bands: true,
            decimalPlaces: true,
            roundingMode: true,
            bandBasis: true,
            reason: true,
            adoptedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    fail(error);
  }
}

/** Only the current active same-school owner sees adopted non-student policy.
 * Same tenant and membership rechecked in the final SQL projection.
 */
export async function listOwnReportGradeScales(schoolId: string) {
  if (!id.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      version: number;
      bands: unknown;
      decimalPlaces: number;
      roundingMode: string;
      bandBasis: string;
      reason: string;
      adoptedAt: Date;
    }>
  >(Prisma.sql`
    SELECT scale."id",scale."version",scale."bands",
      scale."decimalPlaces",scale."roundingMode",scale."bandBasis",
      scale."reason",scale."adoptedAt"
    FROM "ReportGradeScaleRevision" scale
    JOIN "School" school ON school."id"=scale."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId} AND owner."isActive"=true
      AND owner."role"='SCHOOL_SUPER_ADMIN'
    WHERE scale."schoolId"=${schoolId}
    ORDER BY scale."version" DESC LIMIT 100
  `);
}

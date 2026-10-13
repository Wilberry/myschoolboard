import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "@/src/modules/assessments/question-service";

const id = z.string().min(1).max(128).refine(value => value.trim() === value);
const bps = z.number().int().min(0).max(10000);
const previewRow = z.object({
  compositionId: id,
  sourcePacketId: id,
  evidenceRevision: z.number().int().min(1),
  aggregationRuleVersion: z.number().int().min(1),
  gradeScaleVersion: z.number().int().min(1),
  studentCount: z.number().int().min(1).max(500),
  studentId: id,
  admissionNumber: z.string().min(1),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  rawPercentBps: bps,
  displayPercent: z.string().regex(/^(?:100|[0-9]{1,2})(?:\.[0-9]{1,2})?$/),
  gradeCode: z.string().min(1).max(100),
  remark: z.string().min(1).max(500),
  categoryPercentBps: z.object({
    QUIZ: bps.nullable(), TEST: bps.nullable(), EXAM: bps.nullable(),
  }).strict(),
}).strict();

export type PrivateGradePreviewRow = z.infer<typeof previewRow>;

/**
 * School Super Admin ONLY, explicitly requested read of immutable, unreleased
 * historical composition evidence. The final SQL SELECT independently checks
 * the current active same-school owner; cross-tenant IDs return NOT_FOUND.
 *
 * Read the minimum allowlisted grade projection and names frozen in that
 * exact source packet. Do not substitute mutable present-day pupil identity,
 * return either private JSONB packet, raw marks, or answer keys.
 * Never infer a guardian/student link from names, emails or admission numbers.
 */
export async function readPrivateGradePreview(schoolId: string, compositionId: string) {
  if (!id.safeParse(schoolId).success || !id.safeParse(compositionId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const rows = await prisma.$queryRaw<PrivateGradePreviewRow[]>(Prisma.sql`
    SELECT c."id" AS "compositionId", c."sourcePacketId",
      c."evidenceRevision", c."aggregationRuleVersion",
      c."gradeScaleVersion", c."studentCount",
      entry.card->>'studentId' AS "studentId",
      sourcePupil.value->>'admissionNumber' AS "admissionNumber",
      sourcePupil.value->>'givenName' AS "givenName",
      sourcePupil.value->>'familyName' AS "familyName",
      (entry.card->>'rawPercentBps')::integer AS "rawPercentBps",
      entry.card->>'displayPercent' AS "displayPercent",
      entry.card->>'gradeCode' AS "gradeCode",
      entry.card->>'remark' AS "remark",
      entry.card->'categoryPercentBps' AS "categoryPercentBps"
    FROM "PrivateOfficialReportComposition" c
    JOIN "School" school ON school."id"=c."schoolId"
      AND school."isActive"=true
    JOIN "ResultReportCardSourcePacket" source ON
      source."schoolId"=c."schoolId" AND source."id"=c."sourcePacketId"
    CROSS JOIN LATERAL jsonb_array_elements(c."composedStudentCards")
      WITH ORDINALITY AS entry(card, position)
    CROSS JOIN LATERAL jsonb_array_elements(source."studentSourceCards")
      AS sourcePupil(value)
    JOIN "StudentRecord" pupil ON pupil."schoolId"=c."schoolId"
      AND pupil."id"=entry.card->>'studentId'
      AND sourcePupil.value->>'studentId'=pupil."id"
    WHERE c."schoolId"=${schoolId} AND c."id"=${compositionId}
      AND c."status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
      AND entry.card->>'reportStatus'='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
      AND EXISTS (
        SELECT 1 FROM "Membership" owner
        WHERE owner."schoolId"=c."schoolId"
          AND owner."userId"=${userId}
          AND owner."role"='SCHOOL_SUPER_ADMIN'
          AND owner."isActive"=true
      )
    ORDER BY entry.position
    LIMIT 501
  `);
  // If any student record is missing, a JSON row is malformed, or the
  // composition count is inconsistent, reveal no partial class report.
  if (!rows.length || rows.length > 500)
    throw new AssessmentError("NOT_FOUND");
  const parsed = z.array(previewRow).safeParse(rows);
  if (!parsed.success || parsed.data.length !== parsed.data[0].studentCount)
    throw new AssessmentError("NOT_FOUND");
  const seen = new Set<string>();
  for (const row of parsed.data) {
    if (row.compositionId !== compositionId ||
      row.sourcePacketId !== parsed.data[0].sourcePacketId ||
      row.evidenceRevision !== parsed.data[0].evidenceRevision ||
      row.aggregationRuleVersion !== parsed.data[0].aggregationRuleVersion ||
      row.gradeScaleVersion !== parsed.data[0].gradeScaleVersion ||
      row.studentCount !== parsed.data[0].studentCount ||
      seen.has(row.studentId)) throw new AssessmentError("NOT_FOUND");
    seen.add(row.studentId);
  }
  const { sourcePacketId, evidenceRevision, aggregationRuleVersion,
    gradeScaleVersion, studentCount } = parsed.data[0];
  return {
    compositionId, sourcePacketId, evidenceRevision, aggregationRuleVersion,
    gradeScaleVersion, studentCount,
    status: "PRIVATE_GRADE_PREVIEW_NOT_RELEASED" as const,
    students: parsed.data.map(({ studentId, admissionNumber, givenName,
      familyName, rawPercentBps, displayPercent, gradeCode, remark,
      categoryPercentBps }) => ({
      studentId, admissionNumber, givenName, familyName, rawPercentBps,
      displayPercent, gradeCode, remark, categoryPercentBps,
    })),
  };
}

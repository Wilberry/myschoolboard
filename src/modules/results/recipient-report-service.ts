import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError, assessmentUserId,
} from "@/src/modules/assessments/question-service";
import { reportGate } from "@/src/modules/results/report-publication-service";

const id = z.string().min(1).max(128).refine(v => v === v.trim());
const bps = z.number().int().min(0).max(10000);
const row = z.object({
  studentId: id, admissionNumber: z.string().min(1),
  recipientRole: z.enum(["STUDENT","PARENT"]),
  givenName: z.string().min(1), familyName: z.string().min(1),
  schoolName: z.string().min(1), sessionName: z.string().min(1),
  termName: z.string().min(1), className: z.string().min(1),
  subjectName: z.string().min(1),
  sessionId: id, termId: id, classId: id, subjectId: id,
  releaseId: id, releaseOrdinal: z.number().int().min(1),
  policyMode: z.enum(["STUDENT_ONLY", "GUARDIAN_ONLY", "GUARDIAN_FIRST_ACK"]),
  releasedAt: z.date(), rawPercentBps: bps,
  displayPercent: z.string().regex(/^(?:100|[0-9]{1,2})(?:\.[0-9]{1,2})?$/),
  gradeCode: z.string().min(1).max(100),
  remark: z.string().min(1).max(500),
  categoryPercentBps: z.object({
    QUIZ: bps.nullable(), TEST: bps.nullable(), EXAM: bps.nullable(),
  }).strict(),
  guardianHasAcknowledged: z.boolean(),
}).strict();
export type PublishedSubjectRow = z.infer<typeof row>;

function validId(schoolId: string) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
}

/**
 * Recipient-grade SELECT is the authorization boundary. No request-controlled
 * child, guardian or membership identifier. A school can only disclose
 * independently released, latest-version subject grades to its current
 * verified enrolled pupil or unrevoked attested guardian, under the still
 * current school-selected policy. Re-adoption suspends old releases until
 * a distinct owner publication pins the new policy.
 */
export async function readCurrentPublishedReports(schoolId: string) {
  reportGate("recipient");
  validId(schoolId);
  const userId = await assessmentUserId();
  const member = await prisma.membership.findFirst({
    where: { schoolId, userId, isActive: true,
      role: { in: ["STUDENT", "PARENT"] }, school: { isActive: true } },
    select: { id: true },
  });
  if (!member) throw new AssessmentError("NOT_FOUND");
  const rows = await prisma.$queryRaw<PublishedSubjectRow[]>(Prisma.sql`
    SELECT pupil."id" AS "studentId",
      sourcePupil.value->>'admissionNumber' AS "admissionNumber",
      sourcePupil.value->>'givenName' AS "givenName",
      sourcePupil.value->>'familyName' AS "familyName",
      recipient."role" AS "recipientRole",
      school."name" AS "schoolName", session."name" AS "sessionName",
      term."name" AS "termName", classroom."name" AS "className",
      subject."name" AS "subjectName",
      release."sessionId",release."termId",release."classId",
      release."subjectId", release."id" AS "releaseId",
      release."releaseOrdinal",policy."mode" AS "policyMode",
      release."releasedAt",
      (card.value->>'rawPercentBps')::integer AS "rawPercentBps",
      card.value->>'displayPercent' AS "displayPercent",
      card.value->>'gradeCode' AS "gradeCode",
      card.value->>'remark' AS "remark",
      card.value->'categoryPercentBps' AS "categoryPercentBps",
      EXISTS (
        SELECT 1 FROM "ReportGuardianAcknowledgment" receipt
        WHERE receipt."schoolId"=release."schoolId"
          AND receipt."releaseId"=release."id"
          AND receipt."studentId"=pupil."id"
          AND receipt."guardianMembershipId"=recipient."id"
      ) AS "guardianHasAcknowledged"
    FROM "ReportRecipientRelease" release
    JOIN "School" school ON school."id"=release."schoolId"
      AND school."isActive"=true
    JOIN "ReportVisibilityPolicyRevision" policy
      ON policy."schoolId"=release."schoolId"
      AND policy."id"=release."visibilityPolicyId"
      AND policy."version"=(
        SELECT max(latest."version") FROM "ReportVisibilityPolicyRevision" latest
        WHERE latest."schoolId"=school."id")
      AND policy."mode"<>'SCHOOL_ONLY'
    JOIN "PrivateOfficialReportComposition" composition
      ON composition."schoolId"=school."id"
      AND composition."id"=release."compositionId"
      AND composition."status"='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
    JOIN "ResultReportCardSourcePacket" packet
      ON packet."schoolId"=school."id"
      AND packet."id"=composition."sourcePacketId"
    JOIN "AcademicSession" session ON session."schoolId"=school."id"
      AND session."id"=release."sessionId"
    JOIN "AcademicTerm" term ON term."schoolId"=school."id"
      AND term."id"=release."termId"
    JOIN "SchoolClass" classroom ON classroom."schoolId"=school."id"
      AND classroom."id"=release."classId"
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=release."subjectId"
    CROSS JOIN LATERAL jsonb_array_elements(composition."composedStudentCards")
      AS card(value)
    JOIN "StudentRecord" pupil ON pupil."schoolId"=school."id"
      AND pupil."id"=card.value->>'studentId' AND pupil."status"='ENROLLED'
    JOIN "StudentEnrollment" e ON e."schoolId"=school."id"
      AND e."studentId"=pupil."id" AND e."sessionId"=release."sessionId"
      AND e."classId"=release."classId" AND e."status"='ACTIVE'
    JOIN "Membership" recipient ON recipient."schoolId"=school."id"
      AND recipient."userId"=${userId}
      AND recipient."isActive"=true
      AND recipient."role" IN ('STUDENT','PARENT')
    CROSS JOIN LATERAL jsonb_array_elements(packet."studentSourceCards")
      AS sourcePupil(value)
    WHERE release."schoolId"=${schoolId}
      AND card.value->>'reportStatus'='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'
      AND sourcePupil.value->>'studentId'=pupil."id"
      AND NOT EXISTS (
        SELECT 1 FROM "ReportRecipientRelease" newer
        WHERE newer."schoolId"=release."schoolId"
          AND newer."sessionId"=release."sessionId"
          AND newer."termId"=release."termId"
          AND newer."classId"=release."classId"
          AND newer."subjectId"=release."subjectId"
          AND newer."releaseOrdinal">release."releaseOrdinal"
      )
      AND (
        (recipient."role"='PARENT'
          AND policy."mode" IN ('GUARDIAN_ONLY','GUARDIAN_FIRST_ACK')
          AND EXISTS (
            SELECT 1 FROM "GuardianStudentLink" link
            WHERE link."schoolId"=school."id"
              AND link."studentId"=pupil."id"
              AND link."guardianMembershipId"=recipient."id"
              AND NOT EXISTS (
                SELECT 1 FROM "GuardianStudentLinkRevocation" revoked
                WHERE revoked."schoolId"=link."schoolId"
                  AND revoked."linkId"=link."id"
              )
          ))
        OR
        (recipient."role"='STUDENT'
          AND policy."mode" IN ('STUDENT_ONLY','GUARDIAN_FIRST_ACK')
          AND EXISTS (
            SELECT 1 FROM "StudentAccountLink" link
            WHERE link."schoolId"=school."id"
              AND link."studentId"=pupil."id"
              AND link."studentMembershipId"=recipient."id"
              AND NOT EXISTS (
                SELECT 1 FROM "StudentAccountLinkRevocation" revoked
                WHERE revoked."schoolId"=link."schoolId"
                  AND revoked."linkId"=link."id"
              )
          )
          AND (
            policy."mode"='STUDENT_ONLY'
            OR EXISTS (
              SELECT 1 FROM "ReportGuardianAcknowledgment" receipt
              JOIN "GuardianStudentLink" parentLink
                ON parentLink."schoolId"=receipt."schoolId"
                AND parentLink."id"=receipt."guardianLinkId"
                AND parentLink."studentId"=pupil."id"
                AND parentLink."guardianMembershipId"=receipt."guardianMembershipId"
              JOIN "Membership" guardian ON guardian."schoolId"=parentLink."schoolId"
                AND guardian."id"=parentLink."guardianMembershipId"
                AND guardian."role"='PARENT' AND guardian."isActive"=true
              WHERE receipt."schoolId"=release."schoolId"
                AND receipt."releaseId"=release."id"
                AND receipt."studentId"=pupil."id"
                AND NOT EXISTS (
                  SELECT 1 FROM "GuardianStudentLinkRevocation" revoked
                  WHERE revoked."schoolId"=parentLink."schoolId"
                    AND revoked."linkId"=parentLink."id"
                )
            )
          ))
      )
    ORDER BY release."sessionId",release."termId",
      release."classId",pupil."id",subject."name",release."releaseOrdinal" DESC
    LIMIT 101
  `);
  if (rows.length>100) throw new AssessmentError("NOT_FOUND");
  const parsed = z.array(row).safeParse(rows);
  if (!parsed.success) throw new AssessmentError("NOT_FOUND");
  const seen = new Set<string>();
  for (const item of parsed.data) {
    const key = [item.studentId,item.sessionId,item.termId,
      item.classId,item.subjectId].join(":");
    if (seen.has(key)) throw new AssessmentError("NOT_FOUND");
    seen.add(key);
  }
  return {
    status: "RELEASED_SUBJECT_GRADES_BY_VERIFIED_POLICY" as const,
    reports: parsed.data,
  };
}

/** Parent-first receipt for only one exact released child/subject version. */
export async function acknowledgeGuardianReport(
  schoolId: string, releaseId: string, studentId: string, input: unknown,
) {
  reportGate("recipient");
  validId(schoolId);
  if (!id.safeParse(releaseId).success || !id.safeParse(studentId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = z.object({ acknowledge: z.literal(true) }).strict().safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId}
        AND "isActive"=true FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
      const member = await tx.membership.findFirst({
        where: { schoolId, userId, isActive: true, role: "PARENT",
          school: { isActive: true } }, select: { id: true },
      });
      if (!member) throw new AssessmentError("NOT_FOUND");
      const link = await tx.guardianStudentLink.findFirst({
        where: {
          schoolId, studentId, guardianMembershipId: member.id,
          revocation: null,
          student: { status: "ENROLLED",
            enrollments: { some: { schoolId, status: "ACTIVE" } } },
        }, select: { id: true },
      });
      if (!link) throw new AssessmentError("NOT_FOUND");
      return tx.reportGuardianAcknowledgment.create({
        data: {
          id: randomUUID(), schoolId, releaseId, studentId,
          guardianLinkId: link.id,
          guardianMembershipId: member.id,
          actorUserId: userId,
        },
        select: { id: true, releaseId: true, acknowledgedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof AssessmentError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
        throw new AssessmentError("CONFLICT");
      if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
    }
    throw new AssessmentError("INTERNAL");
  }
}

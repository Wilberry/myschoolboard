import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(5).max(500);
export const reportVisibility = z.enum([
  "ASSESSMENT_ONLY",
  "PARENT_ONLY",
  "PARENT_FIRST",
  "PARENT_AND_STUDENT",
]);
const release = z
  .object({ compositionId: identifier, visibility: reportVisibility, reason })
  .strict();
const withdraw = z.object({ publicationId: identifier, reason }).strict();
const acknowledgment = z
  .object({ publicationId: identifier, studentId: identifier })
  .strict();

function failure(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["P2002", "P2003", "P2004", "P2010", "P2034"].includes(String(error.code))
  )
    throw new AssessmentError("CONFLICT");
  throw new AssessmentError("INTERNAL");
}

/** Caller never supplies actor, marks, student roster, policy version or clock. */
export async function publishReport(
  schoolId: string,
  input: unknown,
  withdrawal = false,
) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = (withdrawal ? withdraw : release).safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId} AND "isActive" FOR UPDATE`;
        const owner = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            role: "SCHOOL_SUPER_ADMIN",
            isActive: true,
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!owner) throw new AssessmentError("NOT_FOUND");
        const id = randomUUID();
        if ("compositionId" in parsed.data) {
          return tx.$queryRaw(Prisma.sql`INSERT INTO "ReportPublication"
          ("id","schoolId","compositionId","visibility","reason","actorMembershipId","actorUserId")
          VALUES (${id},${schoolId},${parsed.data.compositionId},${parsed.data.visibility},${parsed.data.reason},${owner.id},${userId})
          RETURNING "id","compositionId","visibility","publishedAt"`);
        }
        return tx.$queryRaw(Prisma.sql`INSERT INTO "ReportPublicationWithdrawal"
        ("id","schoolId","publicationId","reason","actorMembershipId","actorUserId")
        VALUES (${id},${schoolId},${parsed.data.publicationId},${parsed.data.reason},${owner.id},${userId}) RETURNING "id","publicationId","createdAt"`);
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    failure(error);
  }
}

export interface RecipientReport {
  publicationId: string;
  studentId: string;
  givenName: string;
  familyName: string;
  className: string;
  subjectName: string;
  termName: string;
  sessionName: string;
  displayPercent: string;
  gradeCode: string;
  remark: string;
  publishedAt: Date;
}
/** SQL checks every row in the same statement that projects minimal grades.
 * The internal evidence/source JSON never crosses the recipient boundary. */
export async function readPublishedReports(
  schoolId: string,
): Promise<RecipientReport[]> {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const member = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: { in: ["PARENT", "STUDENT"] },
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!member) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<RecipientReport[]>(Prisma.sql`
    SELECT p."id" AS "publicationId",card->>'studentId' AS "studentId",
      identity->>'givenName' AS "givenName",identity->>'familyName' AS "familyName",
      classroom."name" AS "className",subject."name" AS "subjectName",
      term."name" AS "termName",session."name" AS "sessionName",
      card->>'displayPercent' AS "displayPercent",card->>'gradeCode' AS "gradeCode",
      card->>'remark' AS "remark",p."publishedAt"
    FROM "ReportPublication" p
    JOIN "PrivateOfficialReportComposition" c ON c."schoolId"=p."schoolId" AND c."id"=p."compositionId"
    JOIN "ResultReportCardSourcePacket" packet ON packet."schoolId"=c."schoolId" AND packet."id"=c."sourcePacketId"
    JOIN "SchoolClass" classroom ON classroom."schoolId"=c."schoolId" AND classroom."id"=c."classId"
    JOIN "Subject" subject ON subject."schoolId"=c."schoolId" AND subject."id"=c."subjectId" AND subject."isActive"
    JOIN "AcademicTerm" term ON term."schoolId"=c."schoolId" AND term."id"=c."termId"
    JOIN "AcademicSession" session ON session."schoolId"=c."schoolId" AND session."id"=c."sessionId"
    CROSS JOIN LATERAL jsonb_array_elements(c."composedStudentCards") card
    CROSS JOIN LATERAL jsonb_array_elements(packet."studentSourceCards") identity
    WHERE p."schoolId"=${schoolId} AND identity->>'studentId'=card->>'studentId'
      AND "can_read_published_report"(p."schoolId",p."id",card->>'studentId',${userId})
      AND NOT EXISTS (SELECT 1 FROM "ReportPublication" newer
        JOIN "PrivateOfficialReportComposition" nc ON nc."schoolId"=newer."schoolId" AND nc."id"=newer."compositionId"
        WHERE nc."schoolId"=c."schoolId" AND nc."classId"=c."classId" AND nc."subjectId"=c."subjectId"
          AND nc."termId"=c."termId" AND nc."sessionId"=c."sessionId" AND nc."evidenceRevision">c."evidenceRevision")
    ORDER BY p."publishedAt" DESC,card->>'studentId' LIMIT 500`);
}

/** Explicit acknowledgment of one published version, never inferred from GET. */
export async function acknowledgePublishedReport(
  schoolId: string,
  input: unknown,
) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = acknowledgment.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId} AND "isActive" FOR UPDATE`;
        const links = await tx.$queryRaw<
          Array<{ id: string; guardianMembershipId: string }>
        >`SELECT link."id",link."guardianMembershipId"
        FROM "GuardianStudentLink" link JOIN "Membership" m ON m."schoolId"=link."schoolId" AND m."id"=link."guardianMembershipId"
        WHERE link."schoolId"=${schoolId} AND link."studentId"=${parsed.data.studentId} AND m."userId"=${userId} AND m."role"='PARENT' AND m."isActive"
        AND "can_read_published_report"(${schoolId},${parsed.data.publicationId},${parsed.data.studentId},${userId})
        AND NOT EXISTS (SELECT 1 FROM "GuardianStudentLinkRevocation" r WHERE r."schoolId"=link."schoolId" AND r."linkId"=link."id")`;
        if (links.length !== 1) throw new AssessmentError("NOT_FOUND");
        return tx.$queryRaw`INSERT INTO "ReportGuardianAcknowledgment"
        ("id","schoolId","publicationId","studentId","guardianLinkId","actorMembershipId","actorUserId")
        VALUES (${randomUUID()},${schoolId},${parsed.data.publicationId},${parsed.data.studentId},${links[0].id},${links[0].guardianMembershipId},${userId})
        ON CONFLICT ("schoolId","publicationId","studentId","guardianLinkId") DO NOTHING RETURNING "publicationId","createdAt"`;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    failure(error);
  }
}

export async function listReportPublications(schoolId: string) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw(Prisma.sql`SELECT p."id",p."compositionId",p."visibility",p."publishedAt",(w."id" IS NOT NULL) AS withdrawn
    FROM "ReportPublication" p JOIN "School" s ON s."id"=p."schoolId" AND s."isActive"
    JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive"
    LEFT JOIN "ReportPublicationWithdrawal" w ON w."schoolId"=p."schoolId" AND w."publicationId"=p."id"
    WHERE p."schoolId"=${schoolId} ORDER BY p."publishedAt" DESC LIMIT 100`);
}

/** Owner-only labels for an explicit release choice; no pupil data. */
export async function listReportPublicationCompositions(schoolId: string) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  return prisma.$queryRaw(Prisma.sql`SELECT c."id",c."evidenceRevision",c."studentCount",
    classroom."name" AS "className",subject."name" AS "subjectName",term."name" AS "termName",session."name" AS "sessionName"
    FROM "PrivateOfficialReportComposition" c
    JOIN "School" s ON s."id"=c."schoolId" AND s."isActive"
    JOIN "Membership" m ON m."schoolId"=s."id" AND m."userId"=${userId} AND m."role"='SCHOOL_SUPER_ADMIN' AND m."isActive"
    JOIN "SchoolClass" classroom ON classroom."schoolId"=s."id" AND classroom."id"=c."classId"
    JOIN "Subject" subject ON subject."schoolId"=s."id" AND subject."id"=c."subjectId"
    JOIN "AcademicTerm" term ON term."schoolId"=s."id" AND term."id"=c."termId"
    JOIN "AcademicSession" session ON session."schoolId"=s."id" AND session."id"=c."sessionId"
    WHERE c."schoolId"=${schoolId} ORDER BY c."composedAt" DESC LIMIT 100`);
}

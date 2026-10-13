import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError, assessmentUserId,
} from "@/src/modules/assessments/question-service";

const id = z.string().min(1).max(128).refine(v => v === v.trim());
const reason = z.string().trim().min(5).max(500);
export const visibilityModes = [
  "SCHOOL_ONLY", "STUDENT_ONLY", "GUARDIAN_ONLY", "GUARDIAN_FIRST_ACK",
] as const;
const policyInput = z.object({ mode: z.enum(visibilityModes), reason }).strict();
const releaseInput = z.object({
  compositionId: id, visibilityPolicyId: id,
  reason, confirmRecipientRelease: z.literal(true),
}).strict();

export function reportGate(name: "release" | "recipient") {
  // A branch with authored SQL is never an implicit live data-release approval.
  // Both switches are OFF unless separately enabled for a verified deployment.
  if (name === "release" && process.env.PHASE8_REPORT_RELEASE_ENABLED !== "true")
    throw new AssessmentError("NOT_FOUND");
  if (name === "recipient" && process.env.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED !== "true")
    throw new AssessmentError("NOT_FOUND");
}
function failure(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}
function validId(schoolId: string) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
}

/** Adopt an explicit versioned school policy; none is a permission grant. */
export async function adoptReportVisibilityPolicy(schoolId: string, input: unknown) {
  validId(schoolId);
  const parsed = policyInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId}
        AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: {
          schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
          isActive: true, school: { isActive: true },
        }, select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");
      return tx.reportVisibilityPolicyRevision.create({
        data: {
          id: randomUUID(), schoolId, mode: parsed.data.mode,
          reason: parsed.data.reason, actorMembershipId: owner.id,
          actorUserId: userId,
        },
        select: { id: true, version: true, mode: true, adoptedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { failure(error); }
}

/** No implicit default; owner-only policy audit list. */
export async function listReportVisibilityPolicies(schoolId: string) {
  validId(schoolId);
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId, isActive: true, role: "SCHOOL_SUPER_ADMIN",
      school: { isActive: true } }, select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; version: number; mode: typeof visibilityModes[number];
    reason: string; adoptedAt: Date;
  }>>(Prisma.sql`
    SELECT policy."id",policy."version",policy."mode",
      policy."reason",policy."adoptedAt"
    FROM "ReportVisibilityPolicyRevision" policy
    JOIN "School" school ON school."id"=policy."schoolId"
      AND school."isActive"=true
    WHERE policy."schoolId"=${schoolId}
      AND EXISTS (SELECT 1 FROM "Membership" owner
        WHERE owner."schoolId"=school."id"
          AND owner."userId"=${userId}
          AND owner."isActive"=true
          AND owner."role"='SCHOOL_SUPER_ADMIN')
    ORDER BY policy."version" DESC LIMIT 100
  `);
}

/** Separate explicit, auditable recipient release; SQL recertifies evidence. */
export async function releaseOfficialComposition(schoolId: string, input: unknown) {
  reportGate("release");
  validId(schoolId);
  const parsed = releaseInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId}
        AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: {
          schoolId, userId, role: "SCHOOL_SUPER_ADMIN", isActive: true,
          school: { isActive: true },
        }, select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");
      const [composition, policy] = await Promise.all([
        tx.privateOfficialReportComposition.findFirst({
          where: { id: parsed.data.compositionId, schoolId,
            status: "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED" },
          select: { id: true, sessionId: true, termId: true,
            classId: true, subjectId: true, studentCount: true },
        }),
        tx.reportVisibilityPolicyRevision.findFirst({
          where: { id: parsed.data.visibilityPolicyId, schoolId },
          select: { id: true },
        }),
      ]);
      if (!composition || !policy) throw new AssessmentError("NOT_FOUND");
      return tx.reportRecipientRelease.create({
        data: {
          id: randomUUID(), schoolId, compositionId: composition.id,
          visibilityPolicyId: policy.id,
          sessionId: composition.sessionId, termId: composition.termId,
          classId: composition.classId, subjectId: composition.subjectId,
          studentCount: composition.studentCount,
          actorMembershipId: owner.id, actorUserId: userId,
          reason: parsed.data.reason,
        },
        select: {
          id: true, compositionId: true, visibilityPolicyId: true,
          visibilityPolicyVersion: true, releaseOrdinal: true,
          sessionId: true, termId: true, classId: true, subjectId: true,
          studentCount: true, releasedAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { failure(error); }
}

/** Owner audit metadata is visible even when recipient delivery is gated off. */
export async function listReportRecipientReleases(schoolId: string) {
  validId(schoolId);
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
      isActive: true, school: { isActive: true } },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; compositionId: string; visibilityPolicyId: string;
    visibilityPolicyVersion: number; releaseOrdinal: number;
    classId: string; subjectId: string; sessionId: string; termId: string;
    className: string; subjectName: string; studentCount: number;
    releasedAt: Date;
  }>>(Prisma.sql`
    SELECT release."id",release."compositionId",release."visibilityPolicyId",
      release."visibilityPolicyVersion",release."releaseOrdinal",
      release."classId",release."subjectId",
      release."sessionId",release."termId",
      classroom."name" AS "className",subject."name" AS "subjectName",
      release."studentCount",release."releasedAt"
    FROM "ReportRecipientRelease" release
    JOIN "School" school ON school."id"=release."schoolId"
      AND school."isActive"=true
    JOIN "SchoolClass" classroom ON classroom."schoolId"=school."id"
      AND classroom."id"=release."classId"
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=release."subjectId"
    WHERE release."schoolId"=${schoolId}
      AND EXISTS (SELECT 1 FROM "Membership" owner
        WHERE owner."schoolId"=school."id"
          AND owner."userId"=${userId} AND owner."isActive"=true
          AND owner."role"='SCHOOL_SUPER_ADMIN')
    ORDER BY release."releasedAt" DESC,release."id" DESC LIMIT 100
  `);
}

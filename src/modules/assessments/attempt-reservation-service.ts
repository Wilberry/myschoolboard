import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const id = (value: string) =>
  Boolean(value && value === value.trim() && value.length <= 128);

interface Candidate {
  studentId: string;
  enrollmentId: string;
  classId: string;
  sessionId: string;
  studentMembershipId: string;
  linkId: string;
}
export interface ReservedAttempt {
  id: string;
  draftId: string;
  attemptNumber: number;
  startedAt: Date;
  deadlineAt: Date;
}

/** Internal-only admission reservation. Deliberately NOT exported from any
 * Next route or UI before full CBT question/answer/submit policy and local CI.
 * A signed-in account alone is never proof of a pupil/enrollment relationship.
 * SQL BEFORE INSERT revalidates every eligibility edge under row locks,
 * generates the attempt number and sets all timestamps from the DB clock. */
export async function reserveInternalCbtAttempt(
  schoolId: string,
  draftId: string,
): Promise<ReservedAttempt> {
  if (!id(schoolId) || !id(draftId)) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "AssessmentDraft"
        WHERE "schoolId"=${schoolId} AND "id"=${draftId} FOR UPDATE`;
        // Resolve the candidate by exact attested identity and active enrollment.
        // Reject ambiguous school/student enrollments; do not guess the class.
        const candidates = await tx.$queryRaw<Candidate[]>(Prisma.sql`
        SELECT pupil."id" AS "studentId", enrollment."id" AS "enrollmentId",
          draft."classId", draft."sessionId",
          member."id" AS "studentMembershipId", binding."id" AS "linkId"
        FROM "AssessmentDraft" draft
        JOIN "School" school ON school."id"=draft."schoolId"
          AND school."isActive"=true
        JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
          AND seal."draftId"=draft."id"
        JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
          AND review."draftId"=draft."id" AND review."decision"='APPROVED'
        JOIN "AssessmentPublicationEvent" publication
          ON publication."schoolId"=draft."schoolId"
          AND publication."draftId"=draft."id"
          AND publication."action"='PUBLISHED'
        JOIN "Membership" member ON member."schoolId"=draft."schoolId"
          AND member."userId"=${userId}
          AND member."role"='STUDENT' AND member."isActive"=true
        JOIN "StudentAccountLink" binding ON binding."schoolId"=draft."schoolId"
          AND binding."studentMembershipId"=member."id"
        JOIN "StudentRecord" pupil ON pupil."schoolId"=draft."schoolId"
          AND pupil."id"=binding."studentId" AND pupil."status"='ENROLLED'
        JOIN "StudentEnrollment" enrollment
          ON enrollment."schoolId"=draft."schoolId"
          AND enrollment."studentId"=pupil."id"
          AND enrollment."classId"=draft."classId"
          AND enrollment."sessionId"=draft."sessionId"
          AND enrollment."status"='ACTIVE'
        WHERE draft."schoolId"=${schoolId} AND draft."id"=${draftId}
          AND NOT EXISTS (
            SELECT 1 FROM "StudentAccountLinkRevocation" revoked
            WHERE revoked."schoolId"=binding."schoolId"
              AND revoked."linkId"=binding."id"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "AssessmentPublicationEvent" withdrawn
            WHERE withdrawn."schoolId"=draft."schoolId"
              AND withdrawn."draftId"=draft."id"
              AND withdrawn."action"='WITHDRAWN'
          )
        LIMIT 2
      `);
        if (candidates.length !== 1) throw new AssessmentError("NOT_FOUND");
        const candidate = candidates[0];
        const result = await tx.$queryRaw<ReservedAttempt[]>(Prisma.sql`
        INSERT INTO "AssessmentAttempt" (
          "id", "schoolId", "draftId", "studentId", "enrollmentId",
          "classId", "sessionId", "studentMembershipId",
          "linkId", "studentUserId"
        ) VALUES (
          ${randomUUID()}, ${schoolId}, ${draftId},
          ${candidate.studentId}, ${candidate.enrollmentId},
          ${candidate.classId}, ${candidate.sessionId},
          ${candidate.studentMembershipId}, ${candidate.linkId},
          ${userId}
        )
        RETURNING "id", "draftId", "attemptNumber", "startedAt", "deadlineAt"
      `);
        if (result.length !== 1) throw new AssessmentError("INTERNAL");
        return result[0];
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof AssessmentError) throw error;
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2034" || error.code === "P2002") {
        throw new AssessmentError("CONFLICT");
      }
      if (
        error.code === "P2010" &&
        "meta" in error &&
        error.meta &&
        typeof error.meta === "object" &&
        "code" in error.meta
      ) {
        if (error.meta.code === "23505" || error.meta.code === "23514") {
          throw new AssessmentError("CONFLICT");
        }
        if (error.meta.code === "23503") throw new AssessmentError("NOT_FOUND");
      }
    }
    throw new AssessmentError("INTERNAL");
  }
}

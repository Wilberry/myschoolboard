import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const idValid = (v: string) => Boolean(v && v.length <= 128 && v.trim() === v);
export interface ObjectiveScore {
  id: string;
  attemptId: string;
  maxPoints: number;
  earnedPoints: number;
  percentBps: number;
  questionCount: number;
  correctCount: number;
  passed: boolean;
  scoredAt: Date;
}

/** Internal-only automated marking request: never selects question keys in
 * application code. Exact active original teacher starts the transaction,
 * PostgreSQL trigger independently computes the actual weighted result.
 * No student scores or class sheets are published by this action. */
export async function scoreInternalSubmittedAttempt(
  schoolId: string, attemptId: string,
): Promise<ObjectiveScore> {
  if (!idValid(schoolId) || !idValid(attemptId)) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const userId = await assessmentUserId();
  for (let retry = 0; retry < 3; retry++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "School"
          WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "AssessmentAttempt"
          WHERE "schoolId"=${schoolId} AND "id"=${attemptId} FOR UPDATE`;
        const record = await tx.assessmentAttempt.findFirst({
          where: {
            id: attemptId, schoolId,
            draft: {
              seal: { isNot: null },
              reviews: { some: { decision: "APPROVED" } },
              publicationEvents: { some: { action: "PUBLISHED" } },
              assignment: { status: "ACTIVE", membership: {
                userId, role: "TEACHER", isActive: true,
                school: { isActive: true },
              } },
              teacherMembership: { userId, role: "TEACHER", isActive: true },
              session: { status: "ACTIVE" }, term: { status: "ACTIVE" },
              schoolClass: { isActive: true, section: { isActive: true } },
              subject: { isActive: true },
            },
            submission: { isNot: null },
            AND: [{ draft: {
              publicationEvents: { none: { action: "WITHDRAWN" } },
            } }],
          },
          select: { id: true, draft: { select: { teacherMembershipId: true } } },
        });
        if (!record) throw new AssessmentError("NOT_FOUND");
        const previous = await tx.assessmentAttemptScore.findFirst({
          where: { schoolId, attemptId },
          select: { id: true, attemptId: true, maxPoints: true,
            earnedPoints: true, percentBps: true, questionCount: true,
            correctCount: true, passed: true, scoredAt: true },
        });
        if (previous) return previous;
        const rows = await tx.$queryRaw<ObjectiveScore[]>(Prisma.sql`
          INSERT INTO "AssessmentAttemptScore" (
            "id", "schoolId", "attemptId",
            "scorerMembershipId", "scorerUserId"
          ) VALUES (
            ${randomUUID()}, ${schoolId}, ${attemptId},
            ${record.draft.teacherMembershipId}, ${userId}
          )
          RETURNING "id","attemptId","maxPoints","earnedPoints",
            "percentBps","questionCount","correctCount","passed","scoredAt"
        `);
        if (rows.length !== 1) throw new AssessmentError("INTERNAL");
        return rows[0];
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof AssessmentError) throw error;
      if (retry < 2 && error && typeof error === "object" && "code" in error &&
        (error.code === "P2034" || error.code === "P2002" ||
          (error.code === "P2010" && "meta" in error && error.meta &&
            typeof error.meta === "object" && "code" in error.meta &&
            error.meta.code === "40001"))) continue;
      if (error && typeof error === "object" && "code" in error &&
        (error.code === "P2034" || error.code === "P2002")) {
        throw new AssessmentError("CONFLICT");
      }
      throw new AssessmentError("INTERNAL");
    }
  }
  throw new AssessmentError("INTERNAL");
}

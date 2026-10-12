import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "./question-service";

const id = z.string().trim().min(1).max(128);
const requestKey = z.string().uuid();
const answerInput = z.object({
  questionId: id,
  selectedIndex: z.number().int().min(0).max(5),
  idempotencyKey: requestKey,
}).strict();
const submitInput = z.object({ idempotencyKey: requestKey }).strict();
const attemptIdentity = z.object({ schoolId: id, attemptId: id }).strict();

type AnswerAck = {
  id: string;
  questionId: string;
  revision: number;
  createdAt: Date;
};
type SubmissionAck = { id: string; submittedAt: Date };

/** The SQL insert trigger is authoritative. This query is a redundant
 * preflight and controls idempotent replay visibility. No client-provided
 * student, school role, attempt number, time, deadline or key is accepted. */
async function ownWritableAttempt(
  tx: Prisma.TransactionClient, schoolId: string, attemptId: string, userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "School"
    WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "AssessmentAttempt"
    WHERE "schoolId"=${schoolId} AND "id"=${attemptId} FOR UPDATE`;
  const own = await tx.assessmentAttempt.findFirst({
    where: {
      id: attemptId, schoolId, studentUserId: userId,
      school: { isActive: true },
      member: { userId, role: "STUDENT", isActive: true },
      link: { revocation: null },
      student: { status: "ENROLLED" },
      enrollment: { status: "ACTIVE" },
      draft: {
        seal: { isNot: null },
        reviews: { some: { decision: "APPROVED" } },
        publicationEvents: { some: { action: "PUBLISHED" } },
        session: { status: "ACTIVE" },
        term: { status: "ACTIVE" },
        schoolClass: { isActive: true, section: { isActive: true } },
        subject: { isActive: true },
        assignment: { status: "ACTIVE",
          membership: { isActive: true, role: "TEACHER" } },
      },
      AND: [
        { draft: { publicationEvents: { none: { action: "WITHDRAWN" } } } },
      ],
    },
    select: { id: true, studentMembershipId: true, deadlineAt: true },
  });
  if (!own) throw new AssessmentError("NOT_FOUND");
  return own;
}
function retryable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  if (error.code === "P2034") return true;
  return error.code === "P2010" &&
    "meta" in error && Boolean(error.meta) &&
    typeof error.meta === "object" && "code" in error.meta &&
    error.meta.code === "40001";
}
function translate(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002" || error.code === "P2034") {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2010" && "meta" in error && error.meta &&
      typeof error.meta === "object" && "code" in error.meta) {
      if (error.meta.code === "23503") throw new AssessmentError("NOT_FOUND");
      if (error.meta.code === "23505" || error.meta.code === "23514") {
        throw new AssessmentError("CONFLICT");
      }
    }
  }
  throw new AssessmentError("INTERNAL");
}
/** Retrying SERIALIZABLE conflicts permits a genuinely identical concurrent
 * autosave to observe the already committed event rather than duplicating it.
 * Never retry a validation/permission failure. */
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (i < 2 && retryable(error)) continue;
      translate(error);
    }
  }
  throw new AssessmentError("INTERNAL");
}

/** INTERNAL ONLY. Append a server-timestamped, numbered answer snapshot.
 * An exact idempotencyKey + same question + same selectedIndex gets the
 * original acknowledgment, while changed retries fail closed.
 * No question contents, marking keys, scores or sensitive solution records returned. */
export async function saveInternalCbtAnswer(
  schoolId: string, attemptId: string, input: unknown,
): Promise<AnswerAck> {
  if (!attemptIdentity.safeParse({ schoolId, attemptId }).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = answerInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const { questionId, selectedIndex, idempotencyKey } = parsed.data;
  return serializable(async tx => {
    const own = await ownWritableAttempt(tx, schoolId, attemptId, userId);
    const saved = await tx.assessmentAttemptAnswerEvent.findFirst({
      where: { schoolId, attemptId, requestKey: idempotencyKey },
      select: { id: true, questionId: true, selectedIndex: true,
        actorMembershipId: true, actorUserId: true, revision: true, createdAt: true },
    });
    if (saved) {
      if (saved.questionId !== questionId || saved.selectedIndex !== selectedIndex ||
        saved.actorUserId !== userId ||
        saved.actorMembershipId !== own.studentMembershipId) {
        throw new AssessmentError("CONFLICT");
      }
      return {
        id: saved.id, questionId: saved.questionId,
        revision: saved.revision, createdAt: saved.createdAt,
      };
    }
    const created = await tx.assessmentAttemptAnswerEvent.create({
      data: {
        id: randomUUID(), schoolId, attemptId, questionId,
        requestKey: idempotencyKey, selectedIndex,
        actorMembershipId: own.studentMembershipId, actorUserId: userId,
      },
      select: { id: true, questionId: true, revision: true, createdAt: true },
    });
    return created;
  });
}

/** INTERNAL ONLY. Single terminal, immutable student submission.
 * No answer correctness is computed, and no result sheet is created.
 * Identical retries return the same acknowledgment without a second write. */
export async function submitInternalCbtAttempt(
  schoolId: string, attemptId: string, input: unknown,
): Promise<SubmissionAck> {
  if (!attemptIdentity.safeParse({ schoolId, attemptId }).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = submitInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  return serializable(async tx => {
    const own = await ownWritableAttempt(tx, schoolId, attemptId, userId);
    const previous = await tx.assessmentAttemptSubmission.findFirst({
      where: { schoolId, attemptId },
      select: { id: true, requestKey: true, actorMembershipId: true,
        actorUserId: true, submittedAt: true },
    });
    if (previous) {
      if (previous.requestKey !== parsed.data.idempotencyKey ||
        previous.actorMembershipId !== own.studentMembershipId ||
        previous.actorUserId !== userId) throw new AssessmentError("CONFLICT");
      return { id: previous.id, submittedAt: previous.submittedAt };
    }
    return tx.assessmentAttemptSubmission.create({
      data: {
        id: randomUUID(), schoolId, attemptId,
        requestKey: parsed.data.idempotencyKey,
        actorMembershipId: own.studentMembershipId, actorUserId: userId,
      },
      select: { id: true, submittedAt: true },
    });
  });
}

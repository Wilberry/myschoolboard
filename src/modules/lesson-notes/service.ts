import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";

const identifier = z.string().min(1).max(128).refine((value) => value.trim() === value);
const noteText = z.object({
  topic: z.string().trim().min(2).max(180),
  objectives: z.string().trim().min(5).max(4000),
  content: z.string().trim().min(10).max(20000),
}).strict();
const createInput = noteText.extend({
  termId: identifier,
  assignmentId: identifier,
  kind: z.enum(["LESSON_NOTE", "SCHEME_OF_WORK"]).default("LESSON_NOTE"),
  weekStart: z.number().int().min(1).max(53).optional(),
  weekEnd: z.number().int().min(1).max(53).optional(),
}).strict().superRefine((value, context) => {
  if (value.kind === "SCHEME_OF_WORK") {
    if (!value.weekStart || !value.weekEnd || value.weekEnd < value.weekStart) {
      context.addIssue({ code: "custom", message: "Scheme must have valid week range" });
    }
  } else if (value.weekStart !== undefined || value.weekEnd !== undefined) {
    context.addIssue({ code: "custom", message: "Lesson notes do not have scheme weeks" });
  }
});
const reviseInput = noteText.extend({
  expectedRevision: z.number().int().min(1),
}).strict();
const submitInput = z.object({
  expectedRevision: z.number().int().min(1),
}).strict();

export type LessonNoteErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class LessonNoteError extends Error {
  constructor(readonly code: LessonNoteErrorCode) {
    super(code);
    this.name = "LessonNoteError";
  }
}

function checkId(value: string) {
  if (!identifier.safeParse(value).success) {
    throw new LessonNoteError("INVALID_INPUT");
  }
}

async function actorUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new LessonNoteError("UNAUTHENTICATED");
  return session.user.id;
}

async function teacherMembership(
  tx: Prisma.TransactionClient,
  schoolId: string,
  userId: string,
) {
  // Keep tenant and actor locks first, consistent with existing school writes.
  await tx.$queryRaw`SELECT "id" FROM "School"
    WHERE "id" = ${schoolId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "userId" = ${userId} AND "schoolId" = ${schoolId}
    FOR UPDATE`;
  const member = await tx.membership.findFirst({
    where: {
      schoolId,
      userId,
      isActive: true,
      role: "TEACHER",
      school: { isActive: true },
    },
    select: { id: true, schoolId: true, isActive: true, role: true },
  });
  if (!member) throw new LessonNoteError("FORBIDDEN");
  return member;
}

async function requireActiveLessonSource(
  tx: Prisma.TransactionClient,
  schoolId: string,
  userId: string,
  memberId: string,
  termId: string,
  assignmentId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "AcademicTerm"
    WHERE "id" = ${termId} AND "schoolId" = ${schoolId}
    FOR UPDATE`;
  const term = await tx.academicTerm.findFirst({
    where: {
      id: termId,
      schoolId,
      status: "ACTIVE",
      session: { status: "ACTIVE" },
    },
    select: { id: true, sessionId: true },
  });
  if (!term) throw new LessonNoteError("NOT_FOUND");

  await tx.$queryRaw`SELECT "id" FROM "TeacherClassSubjectAssignment"
    WHERE "id" = ${assignmentId} AND "schoolId" = ${schoolId}
    FOR UPDATE`;
  const assignment = await tx.teacherClassSubjectAssignment.findFirst({
    where: {
      id: assignmentId,
      schoolId,
      membershipId: memberId,
      status: "ACTIVE",
      sessionId: term.sessionId,
      schoolClass: { isActive: true },
      subject: { isActive: true },
    },
    select: {
      id: true,
      membershipId: true,
      classId: true,
      subjectId: true,
      sessionId: true,
    },
  });
  if (!assignment || !assignment.sessionId) {
    throw new LessonNoteError("NOT_FOUND");
  }

  const allowed = authorize(
    {
      userId,
      platformRole: "NONE",
      membership: {
        schoolId,
        role: "TEACHER",
        isActive: true,
        scopes: [],
        teacherAssignments: [
          {
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            sessionId: assignment.sessionId,
          },
        ],
      },
    },
    "academic:edit",
    {
      schoolId,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      sessionId: assignment.sessionId,
    },
  ).allowed;

  if (!allowed) throw new LessonNoteError("FORBIDDEN");
  return { assignment, term };
}

export function mapLessonNoteError(error: unknown): never {
  if (error instanceof LessonNoteError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002" || error.code === "P2034") {
      throw new LessonNoteError("CONFLICT");
    }
    if (error.code === "P2003") {
      throw new LessonNoteError("NOT_FOUND");
    }
  }
  throw new LessonNoteError("INTERNAL");
}

const noteProjection = {
  id: true,
  schoolId: true,
  sessionId: true,
  termId: true,
  assignmentId: true,
  classId: true,
  subjectId: true,
  topic: true,
  kind: true,
  weekStart: true,
  weekEnd: true,
  status: true,
  currentRevision: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
} as const;

/** Creation and first immutable revision/audit event are atomic. */
export async function createLessonNote(schoolId: string, input: unknown) {
  checkId(schoolId);
  const parsed = createInput.safeParse(input);
  if (!parsed.success) throw new LessonNoteError("INVALID_INPUT");
  const userId = await actorUserId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const member = await teacherMembership(tx, schoolId, userId);
        const { assignment, term } = await requireActiveLessonSource(
          tx, schoolId, userId, member.id,
          parsed.data.termId, parsed.data.assignmentId,
        );

        const note = await tx.lessonNote.create({
          data: {
            schoolId,
            sessionId: assignment.sessionId!,
            termId: term.id,
            assignmentId: assignment.id,
            teacherMembershipId: member.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            topic: parsed.data.topic,
            kind: parsed.data.kind,
            weekStart: parsed.data.weekStart ?? null,
            weekEnd: parsed.data.weekEnd ?? null,
          },
          select: noteProjection,
        });
        await tx.lessonNoteRevision.create({
          data: {
            schoolId,
            noteId: note.id,
            revisionNumber: 1,
            topic: parsed.data.topic,
            objectives: parsed.data.objectives,
            content: parsed.data.content,
            actorUserId: userId,
          },
        });
        await tx.lessonNoteEvent.create({
          data: {
            schoolId,
            noteId: note.id,
            actorUserId: userId,
            actorMembershipId: member.id,
            eventType: "CREATED",
            revisionNumber: 1,
          },
        });
        return note;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapLessonNoteError(error);
  }
}

async function changeOwnDraft(
  schoolId: string,
  noteId: string,
  input: unknown,
  action: "revise" | "submit",
) {
  checkId(schoolId);
  checkId(noteId);
  const parsed = action === "revise"
    ? reviseInput.safeParse(input)
    : submitInput.safeParse(input);
  if (!parsed.success) throw new LessonNoteError("INVALID_INPUT");
  const data = parsed.data;
  const userId = await actorUserId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const member = await teacherMembership(tx, schoolId, userId);
        const reference = await tx.lessonNote.findFirst({
          where: { schoolId, id: noteId, teacherMembershipId: member.id },
          select: { assignmentId: true, termId: true },
        });
        if (!reference) throw new LessonNoteError("NOT_FOUND");

        await requireActiveLessonSource(
          tx, schoolId, userId, member.id,
          reference.termId, reference.assignmentId,
        );

        await tx.$queryRaw`SELECT "id" FROM "LessonNote"
          WHERE "id" = ${noteId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const note = await tx.lessonNote.findFirst({
          where: { schoolId, id: noteId, teacherMembershipId: member.id },
          select: { id: true, status: true, currentRevision: true },
        });
        if (!note) throw new LessonNoteError("NOT_FOUND");
        const canChange = action === "revise"
          ? note.status === "DRAFT" || note.status === "RETURNED"
          : note.status === "DRAFT";
        if (!canChange || note.currentRevision !== data.expectedRevision) {
          throw new LessonNoteError("CONFLICT");
        }

        if (action === "submit") {
          const result = await tx.lessonNote.update({
            where: { id: noteId },
            data: { status: "SUBMITTED", submittedAt: new Date() },
            select: noteProjection,
          });
          await tx.lessonNoteEvent.create({
            data: {
              schoolId,
              noteId,
              actorUserId: userId,
              actorMembershipId: member.id,
              eventType: "SUBMITTED",
              revisionNumber: note.currentRevision,
            },
          });
          return result;
        }

        if (!("topic" in data) || typeof data.topic !== "string" ||
            !("objectives" in data) || typeof data.objectives !== "string" ||
            !("content" in data) || typeof data.content !== "string") {
          throw new LessonNoteError("INVALID_INPUT");
        }
        const nextRevision = note.currentRevision + 1;
        const result = await tx.lessonNote.update({
          where: { id: noteId },
          // Editing a returned note starts the next draft cycle; the original
          // submission timestamp and review reason remain in immutable events.
          data: {
            topic: data.topic,
            currentRevision: nextRevision,
            ...(note.status === "RETURNED"
              ? { status: "DRAFT" as const, submittedAt: null }
              : {}),
          },
          select: noteProjection,
        });
        await tx.lessonNoteRevision.create({
          data: {
            schoolId,
            noteId,
            revisionNumber: nextRevision,
            topic: data.topic,
            objectives: data.objectives,
            content: data.content,
            actorUserId: userId,
          },
        });
        await tx.lessonNoteEvent.create({
          data: {
            schoolId,
            noteId,
            actorUserId: userId,
            actorMembershipId: member.id,
            eventType: "REVISED",
            revisionNumber: nextRevision,
          },
        });
        return result;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapLessonNoteError(error);
  }
}

export function reviseLessonNote(schoolId: string, noteId: string, input: unknown) {
  return changeOwnDraft(schoolId, noteId, input, "revise");
}

export function submitLessonNote(schoolId: string, noteId: string, input: unknown) {
  return changeOwnDraft(schoolId, noteId, input, "submit");
}

/** Owner-only, active-assignment read; no school admin or student API. */
export async function readOwnLessonNotes(schoolId: string, noteId?: string) {
  checkId(schoolId);
  if (noteId !== undefined) checkId(noteId);
  const userId = await actorUserId();
  const member = await prisma.membership.findFirst({
    where: {
      userId,
      schoolId,
      role: "TEACHER",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!member) throw new LessonNoteError("FORBIDDEN");
  const where = {
    schoolId,
    teacherMembershipId: member.id,
    teacherMembership: {
      userId,
      role: "TEACHER" as const,
      isActive: true,
      school: { isActive: true },
    },
    assignment: {
      status: "ACTIVE" as const,
      academicSession: { status: "ACTIVE" as const },
      schoolClass: { isActive: true },
      subject: { isActive: true },
    },
    term: {
      status: "ACTIVE" as const,
      session: { status: "ACTIVE" as const },
    },
  };

  if (!noteId) {
    return prisma.lessonNote.findMany({
      where,
      select: noteProjection,
      take: 100,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }
  const note = await prisma.lessonNote.findFirst({
    where: { ...where, id: noteId },
    select: {
      ...noteProjection,
      revisions: {
        select: {
          id: true,
          revisionNumber: true,
          topic: true,
          objectives: true,
          content: true,
          createdAt: true,
        },
        orderBy: { revisionNumber: "desc" },
        take: 100,
      },
      events: {
        select: {
          eventType: true,
          revisionNumber: true,
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  if (!note) throw new LessonNoteError("NOT_FOUND");
  return note;
}

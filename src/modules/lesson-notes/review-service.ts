import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { LessonNoteError, mapLessonNoteError } from "@/src/modules/lesson-notes/service";

const id = z.string().min(1).max(128).refine((value) => value.trim() === value);
const decisionSchema = z.object({
  action: z.enum(["APPROVE", "RETURN"]),
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(5).max(500),
}).strict();

interface ReviewRow {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  sectionName: string;
  className: string;
  subjectName: string;
  topic: string;
  currentRevision: number;
  submittedAt: Date;
  revisions: Array<{
    revisionNumber: number;
    topic: string;
    objectives: string;
    content: string;
    createdAt: string;
  }>;
}

async function userId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new LessonNoteError("UNAUTHENTICATED");
  return session.user.id;
}

/** A permitted reviewer must have at least one verified active same-school
 * PRIMARY section if HEAD_OF_SECTION, or SECONDARY if PRINCIPAL. A role alone
 * never grants a class-wide school permission.
 */
async function reviewerIdentity(schoolId: string, actorUserId: string) {
  const actor = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId: actorUserId,
      isActive: true,
      role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
      school: { isActive: true },
    },
    select: {
      id: true,
      role: true,
      scopes: {
        where: { type: "SECTION", verified: true },
        select: { scopeId: true, verified: true },
      },
    },
  });
  if (!actor || actor.scopes.length === 0) {
    throw new LessonNoteError("FORBIDDEN");
  }
  const stage = actor.role === "HEAD_OF_SECTION" ? "PRIMARY" : "SECONDARY";
  const section = await prisma.schoolSection.findFirst({
    where: {
      schoolId,
      isActive: true,
      stage,
      id: { in: actor.scopes.map((scope) => scope.scopeId) },
    },
    select: { id: true },
  });
  if (!section) throw new LessonNoteError("FORBIDDEN");
}

/**
 * All reviewer data is projected in one SQL statement with an equality join
 * from the note's actual class.sectionId to a verified ScopeGrant.
 * Avoid a split read that would combine an unrelated valid section grant
 * with a different class; do not disclose draft or approved notes here.
 */
export async function readSubmittedLessonNotes(
  schoolId: string,
  noteId?: string,
): Promise<ReviewRow[]> {
  if (!id.safeParse(schoolId).success ||
      (noteId !== undefined && !id.safeParse(noteId).success)) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const actorUserId = await userId();
  await reviewerIdentity(schoolId, actorUserId);

  try {
    const rows = await prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
      SELECT n."id", n."schoolId", n."classId",
        section."id" AS "sectionId",
        section."name" AS "sectionName",
        c."name" AS "className",
        subject."name" AS "subjectName",
        n."topic", n."currentRevision", n."submittedAt",
        CASE WHEN ${noteId !== undefined} THEN
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'revisionNumber', rev."revisionNumber",
                'topic', rev."topic",
                'objectives', rev."objectives",
                'content', rev."content",
                'createdAt', rev."createdAt"
              ) ORDER BY rev."revisionNumber" DESC
            )
            FROM (
              SELECT "revisionNumber", "topic", "objectives",
                "content", "createdAt"
              FROM "LessonNoteRevision"
              WHERE "schoolId" = n."schoolId" AND "noteId" = n."id"
              ORDER BY "revisionNumber" DESC
              LIMIT 100
            ) rev
          ), '[]'::jsonb)
        ELSE '[]'::jsonb END AS "revisions"
      FROM "LessonNote" n
      JOIN "School" school
        ON school."id" = n."schoolId" AND school."isActive" = true
      JOIN "SchoolClass" c
        ON c."id" = n."classId"
       AND c."schoolId" = n."schoolId"
       AND c."isActive" = true
      JOIN "SchoolSection" section
        ON section."id" = c."sectionId"
       AND section."schoolId" = c."schoolId"
       AND section."isActive" = true
      JOIN "Subject" subject
        ON subject."id" = n."subjectId"
       AND subject."schoolId" = n."schoolId"
       AND subject."isActive" = true
      JOIN "AcademicTerm" term
        ON term."id" = n."termId"
       AND term."schoolId" = n."schoolId"
       AND term."sessionId" = n."sessionId"
       AND term."status" = 'ACTIVE'
      JOIN "AcademicSession" sess
        ON sess."id" = n."sessionId"
       AND sess."schoolId" = n."schoolId"
       AND sess."status" = 'ACTIVE'
      JOIN "TeacherClassSubjectAssignment" assignment
        ON assignment."id" = n."assignmentId"
       AND assignment."schoolId" = n."schoolId"
       AND assignment."sessionId" = n."sessionId"
       AND assignment."membershipId" = n."teacherMembershipId"
       AND assignment."classId" = n."classId"
       AND assignment."subjectId" = n."subjectId"
       AND assignment."status" = 'ACTIVE'
      JOIN "Membership" teacher
        ON teacher."id" = n."teacherMembershipId"
       AND teacher."schoolId" = n."schoolId"
       AND teacher."isActive" = true
       AND teacher."role" = 'TEACHER'
      JOIN "Membership" reviewer
        ON reviewer."schoolId" = n."schoolId"
       AND reviewer."userId" = ${actorUserId}
       AND reviewer."isActive" = true
       AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
      JOIN "ScopeGrant" grant
        ON grant."membershipId" = reviewer."id"
       AND grant."type" = 'SECTION'
       AND grant."scopeId" = section."id"
       AND grant."verified" = true
      WHERE n."schoolId" = ${schoolId}
        AND n."status" = 'SUBMITTED'
        AND (
          (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
          OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
        )
        AND (${noteId ?? null}::text IS NULL OR n."id" = ${noteId ?? null})
      ORDER BY n."submittedAt" ASC, n."id" ASC
      LIMIT ${noteId ? 1 : 100}
    `);
    if (noteId && rows.length === 0) throw new LessonNoteError("NOT_FOUND");
    return rows;
  } catch (error) {
    mapLessonNoteError(error);
  }
}

/** Reviewer can decide only the current submitted immutable revision.
 * School, actor membership, exact class section and verified ScopeGrant are
 * locked/rechecked in one serializable transaction. This does not release a
 * note to any student or grant author permissions to reviewers.
 */
export async function decideLessonNote(
  schoolId: string,
  noteId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(noteId).success) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new LessonNoteError("INVALID_INPUT");
  const actorUserId = await userId();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id" = ${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId" = ${schoolId} AND "userId" = ${actorUserId}
        FOR UPDATE`;

      const reviewer = await tx.membership.findFirst({
        where: {
          schoolId,
          userId: actorUserId,
          isActive: true,
          school: { isActive: true },
          role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
        },
        select: { id: true, role: true },
      });
      if (!reviewer) throw new LessonNoteError("FORBIDDEN");

      await tx.$queryRaw`SELECT "id" FROM "LessonNote"
        WHERE "id" = ${noteId} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      const note = await tx.lessonNote.findFirst({
        where: {
          id: noteId,
          schoolId,
          term: { status: "ACTIVE", session: { status: "ACTIVE" } },
          schoolClass: { isActive: true },
          subject: { isActive: true },
          assignment: {
            status: "ACTIVE",
            membership: { isActive: true, role: "TEACHER" },
          },
        },
        select: {
          id: true,
          status: true,
          currentRevision: true,
          classId: true,
          schoolClass: { select: { sectionId: true } },
        },
      });
      if (!note || !note.schoolClass.sectionId) {
        throw new LessonNoteError("NOT_FOUND");
      }

      const sectionId = note.schoolClass.sectionId;
      await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
        WHERE "id" = ${note.classId} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "id" = ${sectionId} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ScopeGrant"
        WHERE "membershipId" = ${reviewer.id}
          AND "type" = 'SECTION' AND "scopeId" = ${sectionId}
        FOR UPDATE`;

      const [section, scope] = await Promise.all([
        tx.schoolSection.findFirst({
          where: { id: sectionId, schoolId, isActive: true },
          select: { id: true, stage: true },
        }),
        tx.scopeGrant.findFirst({
          where: {
            membershipId: reviewer.id,
            type: "SECTION",
            scopeId: sectionId,
            verified: true,
          },
          select: { id: true, scopeId: true, verified: true },
        }),
      ]);
      if (!section || !scope) throw new LessonNoteError("NOT_FOUND");
      const correctRoleStage =
        (reviewer.role === "HEAD_OF_SECTION" && section.stage === "PRIMARY") ||
        (reviewer.role === "PRINCIPAL" && section.stage === "SECONDARY");

      // Existing academic:approve action checks the exact verified SECTION
      // scope. Class ownership and role-to-stage alignment are additional
      // independent requirements, never inferred from a client section ID.
      const policyAllows = authorize({
        userId: actorUserId,
        platformRole: "NONE",
        membership: {
          schoolId,
          role: reviewer.role,
          isActive: true,
          scopes: [{ type: "SECTION", scopeId: sectionId, verified: scope.verified }],
          teacherAssignments: [],
        },
      }, "academic:approve", { schoolId, sectionId }).allowed;
      if (!correctRoleStage || !policyAllows) {
        throw new LessonNoteError("NOT_FOUND");
      }
      if (
        note.status !== "SUBMITTED" ||
        note.currentRevision !== parsed.data.expectedRevision
      ) {
        throw new LessonNoteError("CONFLICT");
      }

      const nextStatus = parsed.data.action === "APPROVE"
        ? "APPROVED" as const
        : "RETURNED" as const;
      const result = await tx.lessonNote.update({
        where: { id: note.id },
        data: { status: nextStatus },
        select: {
          id: true, schoolId: true, classId: true, topic: true,
          status: true, currentRevision: true, submittedAt: true,
        },
      });
      await tx.lessonNoteEvent.create({
        data: {
          schoolId,
          noteId: note.id,
          actorUserId,
          actorMembershipId: reviewer.id,
          eventType: nextStatus,
          revisionNumber: note.currentRevision,
          reason: parsed.data.reason,
        },
      });
      return result;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapLessonNoteError(error);
  }
}

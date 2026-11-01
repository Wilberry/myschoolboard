import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LessonNoteError, mapLessonNoteError } from "./service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const inputSchema = z
  .object({
    action: z.enum(["RELEASE", "WITHDRAW"]),
    expectedRevision: z.number().int().min(1),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

/** Release is a new, independently reviewed publication event. The teacher's
 * existing approval is never a student-visible release by itself.
 */
export async function decideLessonRelease(
  schoolId: string,
  noteId: string,
  payload: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(noteId).success) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) throw new LessonNoteError("INVALID_INPUT");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new LessonNoteError("UNAUTHENTICATED");
  const userId = session.user.id;
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id" = ${schoolId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "userId" = ${userId} AND "schoolId" = ${schoolId} FOR UPDATE`;
        const reviewer = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            isActive: true,
            role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
            school: { isActive: true },
          },
          select: { id: true, role: true },
        });
        if (!reviewer) throw new LessonNoteError("FORBIDDEN");
        await tx.$queryRaw`SELECT "id" FROM "LessonNote"
        WHERE "schoolId" = ${schoolId} AND "id" = ${noteId} FOR UPDATE`;
        const note = await tx.lessonNote.findFirst({
          where: {
            id: noteId,
            schoolId,
            status: "APPROVED",
            session: { status: "ACTIVE" },
            term: { status: "ACTIVE" },
            schoolClass: {
              isActive: true,
              section: { isActive: true, schoolId },
            },
            subject: { isActive: true },
            assignment: {
              status: "ACTIVE",
              membership: { isActive: true, role: "TEACHER" },
            },
            events: {
              some: {
                eventType: "APPROVED",
                revisionNumber: parsed.data.expectedRevision,
              },
            },
            revisions: {
              some: { revisionNumber: parsed.data.expectedRevision },
            },
          },
          select: {
            id: true,
            classId: true,
            currentRevision: true,
            schoolClass: { select: { sectionId: true } },
          },
        });
        if (!note || !note.schoolClass.sectionId)
          throw new LessonNoteError("NOT_FOUND");
        if (note.currentRevision !== parsed.data.expectedRevision) {
          throw new LessonNoteError("CONFLICT");
        }
        const sectionId = note.schoolClass.sectionId;
        await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
        WHERE "id" = ${note.classId} AND "schoolId" = ${schoolId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "id" = ${sectionId} AND "schoolId" = ${schoolId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "ScopeGrant"
        WHERE "membershipId" = ${reviewer.id}
          AND "type" = 'SECTION' AND "scopeId" = ${sectionId} FOR UPDATE`;
        const [section, grant] = await Promise.all([
          tx.schoolSection.findFirst({
            where: { id: sectionId, schoolId, isActive: true },
            select: { stage: true },
          }),
          tx.scopeGrant.findFirst({
            where: {
              membershipId: reviewer.id,
              type: "SECTION",
              scopeId: sectionId,
              verified: true,
            },
            select: { id: true },
          }),
        ]);
        if (
          !section ||
          !grant ||
          !(
            (reviewer.role === "HEAD_OF_SECTION" &&
              section.stage === "PRIMARY") ||
            (reviewer.role === "PRINCIPAL" && section.stage === "SECONDARY")
          )
        ) {
          throw new LessonNoteError("NOT_FOUND");
        }
        const events = await tx.lessonReleaseEvent.findMany({
          where: { schoolId, noteId, revisionNumber: note.currentRevision },
          select: { eventType: true },
        });
        const published = events.some((e) => e.eventType === "RELEASED");
        const withdrawn = events.some((e) => e.eventType === "WITHDRAWN");
        if (
          parsed.data.action === "RELEASE"
            ? events.length !== 0
            : !published || withdrawn
        ) {
          throw new LessonNoteError("CONFLICT");
        }
        const eventType =
          parsed.data.action === "RELEASE" ? "RELEASED" : "WITHDRAWN";
        return tx.lessonReleaseEvent.create({
          data: {
            schoolId,
            noteId,
            revisionNumber: note.currentRevision,
            eventType,
            actorUserId: userId,
            actorMembershipId: reviewer.id,
            reason: parsed.data.reason,
          },
          select: {
            id: true,
            noteId: true,
            revisionNumber: true,
            eventType: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapLessonNoteError(error);
  }
}

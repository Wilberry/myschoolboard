import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError,
  actorId,
  mapError,
  requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim());
const reason = z.string().trim().min(5).max(500);
const roomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9 -]*$/)),
    reason,
  })
  .strict();
const slotSchema = z
  .object({
    termId: id,
    assignmentId: id,
    roomId: id.optional(),
    weekday: z.number().int().min(1).max(7),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    reason,
  })
  .strict()
  .refine((value) => value.startMinute < value.endMinute);
const cancelSchema = z.object({ reason }).strict();

export async function createTimetableRoom(schoolId: string, input: unknown) {
  if (!id.safeParse(schoolId).success)
    throw new AcademicConfigError("INVALID_INPUT");
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const room = await tx.timetableRoom.create({
          data: { schoolId, name: parsed.data.name },
          select: { id: true, schoolId: true, name: true, isActive: true },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "TIMETABLE_ROOM_CREATED",
            resourceId: room.id,
            reason: parsed.data.reason,
          },
        });
        return room;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/** Normalize PostgreSQL overlap violations to the same generic 409 as
 * prechecked conflicts; never disclose timetable occupants or locations.
 */
function timetableWriteError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2004" || error.code === "P2010") {
      const details = "meta" in error ? JSON.stringify(error.meta) : "";
      if (/23P01|TimetableSlot_(teacher|class|room)_no_overlap/.test(details)) {
        throw new AcademicConfigError("CONFLICT");
      }
    }
  }
  mapError(error);
}

/** Schedule only exact, active, same-school and same-session teacher assignments. */
export async function createTimetableSlot(schoolId: string, input: unknown) {
  if (!id.safeParse(schoolId).success)
    throw new AcademicConfigError("INVALID_INPUT");
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "AcademicTerm"
          WHERE "id" = ${parsed.data.termId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const term = await tx.academicTerm.findFirst({
          where: {
            id: parsed.data.termId,
            schoolId,
            status: "ACTIVE",
            session: { status: "ACTIVE" },
          },
          select: { id: true, sessionId: true },
        });
        if (!term) throw new AcademicConfigError("NOT_FOUND");

        await tx.$queryRaw`SELECT "id" FROM "TeacherClassSubjectAssignment"
          WHERE "id" = ${parsed.data.assignmentId}
            AND "schoolId" = ${schoolId} FOR UPDATE`;
        const assignment = await tx.teacherClassSubjectAssignment.findFirst({
          where: {
            id: parsed.data.assignmentId,
            schoolId,
            sessionId: term.sessionId,
            status: "ACTIVE",
            membership: { isActive: true, role: "TEACHER" },
            schoolClass: { isActive: true },
            subject: { isActive: true },
          },
          select: {
            id: true,
            membershipId: true,
            classId: true,
            sessionId: true,
          },
        });
        if (!assignment || !assignment.sessionId) {
          throw new AcademicConfigError("NOT_FOUND");
        }

        if (parsed.data.roomId) {
          const room = await tx.timetableRoom.findFirst({
            where: {
              id: parsed.data.roomId,
              schoolId,
              isActive: true,
            },
            select: { id: true },
          });
          if (!room) throw new AcademicConfigError("NOT_FOUND");
        }

        const collisions = await tx.timetableSlot.count({
          where: {
            schoolId,
            termId: term.id,
            weekday: parsed.data.weekday,
            status: "ACTIVE",
            startMinute: { lt: parsed.data.endMinute },
            endMinute: { gt: parsed.data.startMinute },
            OR: [
              { membershipId: assignment.membershipId },
              { classId: assignment.classId },
              ...(parsed.data.roomId ? [{ roomId: parsed.data.roomId }] : []),
            ],
          },
        });
        if (collisions > 0) throw new AcademicConfigError("CONFLICT");

        const slot = await tx.timetableSlot.create({
          data: {
            schoolId,
            sessionId: assignment.sessionId,
            termId: term.id,
            assignmentId: assignment.id,
            membershipId: assignment.membershipId,
            classId: assignment.classId,
            roomId: parsed.data.roomId ?? null,
            weekday: parsed.data.weekday,
            startMinute: parsed.data.startMinute,
            endMinute: parsed.data.endMinute,
          },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            termId: true,
            assignmentId: true,
            membershipId: true,
            classId: true,
            roomId: true,
            weekday: true,
            startMinute: true,
            endMinute: true,
            status: true,
          },
        });
        await tx.timetableEvent.create({
          data: {
            schoolId,
            slotId: slot.id,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "CREATED",
            reason: parsed.data.reason,
          },
        });
        return slot;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    timetableWriteError(error);
  }
}

/** Explicit cancellation preserves the slot and both audit events. */
export async function cancelTimetableSlot(
  schoolId: string,
  slotId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(slotId).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "TimetableSlot"
          WHERE "id" = ${slotId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const previous = await tx.timetableSlot.findFirst({
          where: { id: slotId, schoolId },
          select: { id: true, status: true },
        });
        if (!previous) throw new AcademicConfigError("NOT_FOUND");
        if (previous.status !== "ACTIVE") {
          throw new AcademicConfigError("CONFLICT");
        }
        const slot = await tx.timetableSlot.update({
          where: { id: slotId },
          data: { status: "CANCELLED" },
          select: {
            id: true,
            schoolId: true,
            termId: true,
            status: true,
          },
        });
        await tx.timetableEvent.create({
          data: {
            schoolId,
            slotId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "CANCELLED",
            reason: parsed.data.reason,
          },
        });
        return slot;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

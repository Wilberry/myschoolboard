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
  .refine((value) => value.trim() === value);
const reason = z.string().trim().min(5).max(500);
const admissionNumber = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9/-]*$/);

const registerSchema = z
  .object({
    admissionNumber,
    givenName: z.string().trim().min(2).max(100),
    familyName: z.string().trim().min(2).max(100),
    reason,
  })
  .strict();
const enrollSchema = z
  .object({
    sessionId: id,
    classId: id,
    reason,
  })
  .strict();
const withdrawSchema = z.object({ reason }).strict();

function requireId(value: string) {
  if (!id.safeParse(value).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
}

const studentPublicProjection = {
  id: true,
  schoolId: true,
  admissionNumber: true,
  status: true,
} as const;
const enrollmentProjection = {
  id: true,
  schoolId: true,
  studentId: true,
  sessionId: true,
  classId: true,
  status: true,
  startedAt: true,
  endedAt: true,
} as const;

/** Student personal details have no public or teacher/guardian GET endpoint. */
export async function registerStudent(schoolId: string, input: unknown) {
  requireId(schoolId);
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const student = await tx.studentRecord.create({
          data: {
            schoolId,
            admissionNumber: parsed.data.admissionNumber,
            givenName: parsed.data.givenName,
            familyName: parsed.data.familyName,
            status: "REGISTERED",
          },
          select: studentPublicProjection,
        });
        await tx.studentEvent.create({
          data: {
            schoolId,
            studentId: student.id,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "REGISTERED",
            reason: parsed.data.reason,
          },
        });
        return student;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/** Make one active school/year/class relationship, without guessing prior
 * admission or enrollment data. A class needs an active, explicit section.
 */
export async function enrollStudent(
  schoolId: string,
  studentId: string,
  input: unknown,
) {
  requireId(schoolId);
  requireId(studentId);
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "StudentRecord"
          WHERE "id" = ${studentId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
          WHERE "id" = ${parsed.data.sessionId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
          WHERE "id" = ${parsed.data.classId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;

        const [student, session, schoolClass] = await Promise.all([
          tx.studentRecord.findFirst({
            where: { id: studentId, schoolId, status: "REGISTERED" },
            select: { id: true },
          }),
          tx.academicSession.findFirst({
            where: {
              id: parsed.data.sessionId,
              schoolId,
              status: "ACTIVE",
            },
            select: { id: true },
          }),
          tx.schoolClass.findFirst({
            where: {
              id: parsed.data.classId,
              schoolId,
              isActive: true,
              section: { isActive: true, schoolId },
            },
            select: { id: true },
          }),
        ]);
        if (!student || !session || !schoolClass) {
          throw new AcademicConfigError("NOT_FOUND");
        }

        const enrollment = await tx.studentEnrollment.create({
          data: {
            schoolId,
            studentId,
            sessionId: session.id,
            classId: schoolClass.id,
          },
          select: enrollmentProjection,
        });
        await tx.studentRecord.update({
          where: { id: studentId },
          data: { status: "ENROLLED" },
        });
        await tx.studentEvent.create({
          data: {
            schoolId,
            studentId,
            enrollmentId: enrollment.id,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "ENROLLED",
            reason: parsed.data.reason,
          },
        });
        return enrollment;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/** Ending a student enrollment is explicit and preserves the historical
 * class and academic period. Re-enrollment and promotion are separate,
 * auditable lifecycle operations to be implemented later.
 */
export async function withdrawStudent(
  schoolId: string,
  studentId: string,
  enrollmentId: string,
  input: unknown,
) {
  requireId(schoolId);
  requireId(studentId);
  requireId(enrollmentId);
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "StudentRecord"
          WHERE "id" = ${studentId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "StudentEnrollment"
          WHERE "id" = ${enrollmentId}
            AND "studentId" = ${studentId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const [student, current] = await Promise.all([
          tx.studentRecord.findFirst({
            where: { id: studentId, schoolId, status: "ENROLLED" },
            select: { id: true },
          }),
          tx.studentEnrollment.findFirst({
            where: {
              id: enrollmentId,
              schoolId,
              studentId,
              status: "ACTIVE",
            },
            select: { id: true },
          }),
        ]);
        if (!student || !current) throw new AcademicConfigError("NOT_FOUND");
        const enrollment = await tx.studentEnrollment.update({
          where: { id: enrollmentId },
          data: { status: "ENDED", endedAt: new Date() },
          select: enrollmentProjection,
        });
        await tx.studentRecord.update({
          where: { id: studentId },
          data: { status: "WITHDRAWN" },
        });
        await tx.studentEvent.create({
          data: {
            schoolId,
            studentId,
            enrollmentId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "WITHDRAWN",
            reason: parsed.data.reason,
          },
        });
        return enrollment;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

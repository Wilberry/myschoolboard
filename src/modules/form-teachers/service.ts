import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError,
  mapError,
  requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const reason = z.string().trim().min(5).max(500);
const assignSchema = z
  .object({
    sessionId: id,
    classId: id,
    teacherMembershipId: id,
    kind: z.enum(["PRIMARY", "SUPPORT"]),
    reason,
  })
  .strict();
const handoverSchema = z
  .object({
    replacementMembershipId: id,
    reason,
  })
  .strict();

async function actorId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AcademicConfigError("UNAUTHENTICATED");
  return session.user.id;
}

async function requireTarget(
  tx: Prisma.TransactionClient,
  schoolId: string,
  sessionId: string,
  classId: string,
  membershipId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
    WHERE "id" = ${sessionId} AND "schoolId" = ${schoolId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
    WHERE "id" = ${classId} AND "schoolId" = ${schoolId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "id" = ${membershipId} AND "schoolId" = ${schoolId} FOR UPDATE`;

  const [period, schoolClass, teacher] = await Promise.all([
    tx.academicSession.findFirst({
      where: { id: sessionId, schoolId, status: "ACTIVE" },
      select: { id: true },
    }),
    tx.schoolClass.findFirst({
      where: { id: classId, schoolId, isActive: true },
      select: { id: true },
    }),
    tx.membership.findFirst({
      where: {
        id: membershipId,
        schoolId,
        isActive: true,
        role: { in: ["TEACHER", "FORM_TEACHER"] },
      },
      select: { id: true },
    }),
  ]);
  if (!period || !schoolClass || !teacher) {
    throw new AcademicConfigError("NOT_FOUND");
  }
}

export async function assignFormTeacher(schoolId: string, input: unknown) {
  if (!id.safeParse(schoolId).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const school = await tx.school.findUniqueOrThrow({
          where: { id: schoolId },
          select: { allowCoFormTeachers: true },
        });
        if (parsed.data.kind === "SUPPORT" && !school.allowCoFormTeachers) {
          throw new AcademicConfigError("CONFLICT");
        }
        await requireTarget(
          tx,
          schoolId,
          parsed.data.sessionId,
          parsed.data.classId,
          parsed.data.teacherMembershipId,
        );
        if (parsed.data.kind === "SUPPORT") {
          const primary = await tx.formTeacherResponsibility.findFirst({
            where: {
              schoolId,
              sessionId: parsed.data.sessionId,
              classId: parsed.data.classId,
              status: "ACTIVE",
              kind: "PRIMARY",
            },
            select: { id: true },
          });
          if (!primary) throw new AcademicConfigError("CONFLICT");
        }
        const responsibility = await tx.formTeacherResponsibility.create({
          data: {
            schoolId,
            sessionId: parsed.data.sessionId,
            classId: parsed.data.classId,
            membershipId: parsed.data.teacherMembershipId,
            kind: parsed.data.kind,
          },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            classId: true,
            membershipId: true,
            kind: true,
            status: true,
          },
        });
        await tx.formTeacherEvent.create({
          data: {
            schoolId,
            responsibilityId: responsibility.id,
            teacherMembershipId: responsibility.membershipId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "ASSIGNED",
            reason: parsed.data.reason,
          },
        });
        return responsibility;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

export async function handoverFormTeacher(
  schoolId: string,
  responsibilityId: string,
  input: unknown,
) {
  if (
    !id.safeParse(schoolId).success ||
    !id.safeParse(responsibilityId).success
  ) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = handoverSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "FormTeacherResponsibility"
          WHERE "id" = ${responsibilityId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const current = await tx.formTeacherResponsibility.findFirst({
          where: {
            id: responsibilityId,
            schoolId,
            status: "ACTIVE",
            kind: "PRIMARY",
          },
        });
        if (!current) throw new AcademicConfigError("NOT_FOUND");
        if (current.membershipId === parsed.data.replacementMembershipId) {
          throw new AcademicConfigError("CONFLICT");
        }
        await requireTarget(
          tx,
          schoolId,
          current.sessionId,
          current.classId,
          parsed.data.replacementMembershipId,
        );

        await tx.formTeacherResponsibility.update({
          where: { id: responsibilityId },
          data: { status: "ENDED", endedAt: new Date() },
        });
        const replacement = await tx.formTeacherResponsibility.create({
          data: {
            schoolId,
            sessionId: current.sessionId,
            classId: current.classId,
            membershipId: parsed.data.replacementMembershipId,
            kind: "PRIMARY",
          },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            classId: true,
            membershipId: true,
            kind: true,
            status: true,
          },
        });
        await tx.formTeacherEvent.createMany({
          data: [
            {
              schoolId,
              responsibilityId: current.id,
              teacherMembershipId: current.membershipId,
              actorUserId: userId,
              actorMembershipId: actor.membershipId,
              eventType: "HANDOVER_OUT",
              reason: parsed.data.reason,
            },
            {
              schoolId,
              responsibilityId: replacement.id,
              teacherMembershipId: replacement.membershipId,
              actorUserId: userId,
              actorMembershipId: actor.membershipId,
              eventType: "HANDOVER_IN",
              reason: parsed.data.reason,
            },
          ],
        });
        return replacement;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

const policySchema = z
  .object({
    allowCoFormTeachers: z.boolean(),
    reason,
  })
  .strict();

/** Auditable school setting; no staff relationships are rewritten. */
export async function updateFormTeacherPolicy(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        // Disabling co-responsibility cannot strand an active SUPPORT assignment.
        if (!parsed.data.allowCoFormTeachers) {
          const remaining = await tx.formTeacherResponsibility.count({
            where: { schoolId, kind: "SUPPORT", status: "ACTIVE" },
          });
          if (remaining > 0) throw new AcademicConfigError("CONFLICT");
        }
        const school = await tx.school.update({
          where: { id: schoolId },
          data: { allowCoFormTeachers: parsed.data.allowCoFormTeachers },
          select: { id: true, allowCoFormTeachers: true },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "FORM_TEACHER_POLICY_CHANGED",
            resourceId: schoolId,
            reason: parsed.data.reason,
          },
        });
        return school;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

const endSchema = z.object({ reason }).strict();

/** End a responsibility without deleting any historical assignment or event. */
export async function endFormTeacher(
  schoolId: string,
  responsibilityId: string,
  input: unknown,
) {
  if (
    !id.safeParse(schoolId).success ||
    !id.safeParse(responsibilityId).success
  ) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = endSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "FormTeacherResponsibility"
          WHERE "id" = ${responsibilityId} AND "schoolId" = ${schoolId}
          FOR UPDATE`;
        const current = await tx.formTeacherResponsibility.findFirst({
          where: { id: responsibilityId, schoolId, status: "ACTIVE" },
        });
        if (!current) throw new AcademicConfigError("NOT_FOUND");
        if (current.kind === "PRIMARY") {
          const supports = await tx.formTeacherResponsibility.count({
            where: {
              schoolId,
              sessionId: current.sessionId,
              classId: current.classId,
              kind: "SUPPORT",
              status: "ACTIVE",
            },
          });
          if (supports > 0) throw new AcademicConfigError("CONFLICT");
        }

        const ended = await tx.formTeacherResponsibility.update({
          where: { id: responsibilityId },
          data: { status: "ENDED", endedAt: new Date() },
          select: {
            id: true,
            schoolId: true,
            classId: true,
            sessionId: true,
            membershipId: true,
            kind: true,
            status: true,
          },
        });
        await tx.formTeacherEvent.create({
          data: {
            schoolId,
            responsibilityId: current.id,
            teacherMembershipId: current.membershipId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "ENDED",
            reason: parsed.data.reason,
          },
        });
        return ended;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

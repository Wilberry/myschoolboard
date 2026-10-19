import { headers } from "next/headers";
import { TeacherClassSubjectAssignmentStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { classifyAssignmentDatabaseError } from "./database-error";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim());
const reasonSchema = z.string().trim().min(1).max(500);

const createSchema = z
  .object({
    schoolId: identifier,
    teacherMembershipId: identifier,
    classId: identifier,
    subjectId: identifier,
    sessionId: identifier.optional(),
  })
  .strict();

const lifecycleSchema = z
  .object({
    schoolId: identifier,
    assignmentId: identifier,
    reason: reasonSchema.optional(),
  })
  .strict();

export type AssignmentServiceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "INTERNAL";

export class AssignmentServiceError extends Error {
  constructor(readonly code: AssignmentServiceErrorCode) {
    super(code);
    this.name = "AssignmentServiceError";
  }
}

interface Actor {
  userId: string;
  schoolId: string;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AssignmentServiceError("INVALID_INPUT");
  return result.data;
}

async function requireActor(schoolId: string): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AssignmentServiceError("UNAUTHENTICATED");
  return { userId: session.user.id, schoolId };
}

async function assertActorCanManage(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  actor: Actor,
): Promise<{ membershipId: string }> {
  // Lock the school before memberships. Concurrent deactivation/deletion must
  // either complete first or wait until this mutation commits.
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "School" WHERE "id" = ${actor.schoolId} FOR UPDATE
  `;
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Membership"
    WHERE "userId" = ${actor.userId} AND "schoolId" = ${actor.schoolId}
    FOR UPDATE
  `;
  const membership = await tx.membership.findFirst({
    where: {
      userId: actor.userId,
      schoolId: actor.schoolId,
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true, role: true, isActive: true, schoolId: true },
  });

  if (!membership) {
    throw new AssignmentServiceError("FORBIDDEN");
  }
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, platformRole: true },
  });
  if (
    !user ||
    !authorize(
      {
        userId: user.id,
        platformRole: user.platformRole,
        membership: {
          schoolId: membership.schoolId,
          role: membership.role,
          isActive: membership.isActive,
          scopes: [],
          teacherAssignments: [],
        },
      },
      "school:configure",
      { schoolId: actor.schoolId },
    ).allowed
  ) {
    throw new AssignmentServiceError("FORBIDDEN");
  }
  return { membershipId: membership.id };
}

function mapDatabaseError(error: unknown): never {
  throw new AssignmentServiceError(classifyAssignmentDatabaseError(error));
}


function requireReason(reason: string | undefined): string {
  if (!reason) throw new AssignmentServiceError("INVALID_INPUT");
  return reason;
}

export async function createTeacherClassSubjectAssignment(input: unknown) {
  const data = parseInput(createSchema, input);
  const actor = await requireActor(data.schoolId);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const currentActor = await assertActorCanManage(tx, actor);

        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Membership"
          WHERE "id" = ${data.teacherMembershipId}
            AND "schoolId" = ${data.schoolId}
          FOR UPDATE
        `;
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "SchoolClass"
          WHERE "id" = ${data.classId} AND "schoolId" = ${data.schoolId}
          FOR UPDATE
        `;
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Subject"
          WHERE "id" = ${data.subjectId} AND "schoolId" = ${data.schoolId}
          FOR UPDATE
        `;

        if (data.sessionId) {
          await tx.$queryRaw`
            SELECT "id" FROM "AcademicSession"
            WHERE "id" = ${data.sessionId}
              AND "schoolId" = ${data.schoolId}
            FOR UPDATE
          `;
          const academicSession = await tx.academicSession.findFirst({
            where: {
              id: data.sessionId,
              schoolId: data.schoolId,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          if (!academicSession) {
            throw new AssignmentServiceError("NOT_FOUND");
          }
        }

        const [teacher, schoolClass, subject] = await Promise.all([
          tx.membership.findFirst({
            where: {
              id: data.teacherMembershipId,
              schoolId: data.schoolId,
              role: "TEACHER",
              isActive: true,
            },
            select: { id: true },
          }),
          tx.schoolClass.findFirst({
            where: {
              id: data.classId,
              schoolId: data.schoolId,
              isActive: true,
            },
            select: { id: true },
          }),
          tx.subject.findFirst({
            where: {
              id: data.subjectId,
              schoolId: data.schoolId,
              isActive: true,
            },
            select: { id: true },
          }),
        ]);

        if (!teacher || !schoolClass || !subject) {
          throw new AssignmentServiceError("NOT_FOUND");
        }

        const assignment = await tx.teacherClassSubjectAssignment.create({
          data: {
            schoolId: data.schoolId,
            membershipId: teacher.id,
            classId: schoolClass.id,
            subjectId: subject.id,
            sessionId: data.sessionId ?? null,
          },
        });
        await tx.teacherClassSubjectAssignmentEvent.create({
          data: {
            schoolId: data.schoolId,
            actorUserId: actor.userId,
            actorMembershipId: currentActor.membershipId,
            teacherMembershipId: teacher.id,
            assignmentId: assignment.id,
            eventType: "CREATED",
            newStatus: "ACTIVE",
          },
        });
        return assignment;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof AssignmentServiceError) throw error;
    mapDatabaseError(error);
  }
}

async function transitionAssignment(
  eventType: "DEACTIVATED" | "REVOKED" | "REACTIVATED",
  input: unknown,
) {
  const data = parseInput(lifecycleSchema, input);
  if (eventType !== "REACTIVATED") requireReason(data.reason);
  const actor = await requireActor(data.schoolId);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const currentActor = await assertActorCanManage(tx, actor);

        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "TeacherClassSubjectAssignment"
          WHERE "id" = ${data.assignmentId} AND "schoolId" = ${data.schoolId}
          FOR UPDATE
        `;
        const assignment = await tx.teacherClassSubjectAssignment.findFirst({
          where: { id: data.assignmentId, schoolId: data.schoolId },
        });
        if (!assignment) throw new AssignmentServiceError("NOT_FOUND");

        const validSourceStates: Record<
          typeof eventType,
          TeacherClassSubjectAssignmentStatus[]
        > = {
          DEACTIVATED: [TeacherClassSubjectAssignmentStatus.ACTIVE],
          REVOKED: [
            TeacherClassSubjectAssignmentStatus.ACTIVE,
            TeacherClassSubjectAssignmentStatus.INACTIVE,
          ],
          REACTIVATED: [
            TeacherClassSubjectAssignmentStatus.INACTIVE,
            TeacherClassSubjectAssignmentStatus.REVOKED,
          ],
        };
        if (!validSourceStates[eventType].includes(assignment.status)) {
          throw new AssignmentServiceError("INVALID_STATE");
        }

        if (eventType === "REACTIVATED") {
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "Membership"
            WHERE "id" = ${assignment.membershipId}
              AND "schoolId" = ${data.schoolId}
            FOR UPDATE
          `;
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "SchoolClass"
            WHERE "id" = ${assignment.classId} AND "schoolId" = ${data.schoolId}
            FOR UPDATE
          `;
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "Subject"
            WHERE "id" = ${assignment.subjectId} AND "schoolId" = ${data.schoolId}
            FOR UPDATE
          `;
          if (assignment.sessionId) {
            await tx.$queryRaw`
              SELECT "id" FROM "AcademicSession"
              WHERE "id" = ${assignment.sessionId}
                AND "schoolId" = ${data.schoolId}
              FOR UPDATE
            `;
            const academicSession = await tx.academicSession.findFirst({
              where: {
                id: assignment.sessionId,
                schoolId: data.schoolId,
                status: "ACTIVE",
              },
              select: { id: true },
            });
            if (!academicSession) {
              throw new AssignmentServiceError("NOT_FOUND");
            }
          }

          const [teacher, schoolClass, subject] = await Promise.all([
            tx.membership.findFirst({
              where: {
                id: assignment.membershipId,
                schoolId: data.schoolId,
                role: "TEACHER",
                isActive: true,
              },
              select: { id: true },
            }),
            tx.schoolClass.findFirst({
              where: {
                id: assignment.classId,
                schoolId: data.schoolId,
                isActive: true,
              },
              select: { id: true },
            }),
            tx.subject.findFirst({
              where: {
                id: assignment.subjectId,
                schoolId: data.schoolId,
                isActive: true,
              },
              select: { id: true },
            }),
          ]);
          if (!teacher || !schoolClass || !subject) {
            throw new AssignmentServiceError("NOT_FOUND");
          }
        }

        const newStatus =
          eventType === "DEACTIVATED"
            ? TeacherClassSubjectAssignmentStatus.INACTIVE
            : eventType === "REVOKED"
              ? TeacherClassSubjectAssignmentStatus.REVOKED
              : TeacherClassSubjectAssignmentStatus.ACTIVE;
        const updated = await tx.teacherClassSubjectAssignment.updateMany({
          where: {
            id: assignment.id,
            schoolId: data.schoolId,
            status: assignment.status,
          },
          data: { status: newStatus },
        });
        if (updated.count !== 1) {
          throw new AssignmentServiceError("CONFLICT");
        }

        await tx.teacherClassSubjectAssignmentEvent.create({
          data: {
            schoolId: data.schoolId,
            actorUserId: actor.userId,
            actorMembershipId: currentActor.membershipId,
            teacherMembershipId: assignment.membershipId,
            assignmentId: assignment.id,
            eventType,
            previousStatus: assignment.status,
            newStatus,
            reason: data.reason,
          },
        });

        return tx.teacherClassSubjectAssignment.findUniqueOrThrow({
          where: { id: assignment.id },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof AssignmentServiceError) throw error;
    mapDatabaseError(error);
  }
}

export function deactivateTeacherClassSubjectAssignment(input: unknown) {
  return transitionAssignment("DEACTIVATED", input);
}

export function revokeTeacherClassSubjectAssignment(input: unknown) {
  return transitionAssignment("REVOKED", input);
}

export function reactivateTeacherClassSubjectAssignment(input: unknown) {
  return transitionAssignment("REACTIVATED", input);
}

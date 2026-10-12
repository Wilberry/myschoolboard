import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";

const name = z.string().trim().min(2).max(120);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().trim().min(1).max(128);

const sessionSchema = z
  .object({ name, startsOn: dateString, endsOn: dateString })
  .strict();

const termSchema = z
  .object({
    name,
    position: z.number().int().min(1).max(8),
    startsOn: dateString,
    endsOn: dateString,
  })
  .strict();

const catalogSchema = z.object({ name }).strict();

export type AcademicConfigErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class AcademicConfigError extends Error {
  constructor(readonly code: AcademicConfigErrorCode) {
    super(code);
    this.name = "AcademicConfigError";
  }
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  return date;
}

export function validateDateRange(
  start: string,
  end: string,
): { startsOn: Date; endsOn: Date } {
  const startsOn = parseDate(start);
  const endsOn = parseDate(end);
  if (startsOn >= endsOn) throw new AcademicConfigError("INVALID_INPUT");
  return { startsOn, endsOn };
}

async function actorId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AcademicConfigError("UNAUTHENTICATED");
  return session.user.id;
}

async function requireSchoolConfigActor(
  tx: Prisma.TransactionClient,
  userId: string,
  schoolId: string,
): Promise<{ membershipId: string }> {
  // Match the mutation lock order: school first, then actor membership.
  await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "userId" = ${userId} AND "schoolId" = ${schoolId} FOR UPDATE`;
  const member = await tx.membership.findFirst({
    where: {
      userId,
      schoolId,
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true, schoolId: true, isActive: true, role: true },
  });
  if (
    !member ||
    !authorize(
      {
        userId,
        platformRole: "NONE",
        membership: {
          schoolId: member.schoolId,
          role: member.role,
          isActive: member.isActive,
          scopes: [],
          teacherAssignments: [],
        },
      },
      "school:configure",
      { schoolId },
    ).allowed
  ) {
    throw new AcademicConfigError("FORBIDDEN");
  }
  return { membershipId: member.id };
}

function mapError(error: unknown): never {
  if (error instanceof AcademicConfigError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    throw new AcademicConfigError("CONFLICT");
  }
  throw new AcademicConfigError("INTERNAL");
}

export async function createAcademicSession(schoolId: string, input: unknown) {
  if (!id.safeParse(schoolId).success) throw new AcademicConfigError("INVALID_INPUT");
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const dates = validateDateRange(parsed.data.startsOn, parsed.data.endsOn);
  const userId = await actorId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const session = await tx.academicSession.create({
          data: {
            schoolId,
            name: parsed.data.name,
            ...dates,
            status: "PLANNED",
          },
          select: {
            id: true,
            schoolId: true,
            name: true,
            startsOn: true,
            endsOn: true,
            status: true,
          },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "ACADEMIC_SESSION_CREATED",
            resourceId: session.id,
          },
        });
        return session;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

export async function createAcademicTerm(
  schoolId: string,
  sessionId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(sessionId).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
  const parsed = termSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const dates = validateDateRange(parsed.data.startsOn, parsed.data.endsOn);
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
          WHERE "id" = ${sessionId} AND "schoolId" = ${schoolId} FOR UPDATE`;
        const session = await tx.academicSession.findFirst({
          where: { schoolId, id: sessionId },
          select: { startsOn: true, endsOn: true, status: true },
        });
        if (!session || session.status === "CLOSED") {
          throw new AcademicConfigError("NOT_FOUND");
        }
        if (dates.startsOn < session.startsOn || dates.endsOn > session.endsOn) {
          throw new AcademicConfigError("INVALID_INPUT");
        }
        const term = await tx.academicTerm.create({
          data: {
            schoolId,
            sessionId,
            name: parsed.data.name,
            position: parsed.data.position,
            ...dates,
            status: "PLANNED",
          },
          select: {
            id: true,
            schoolId: true,
            sessionId: true,
            name: true,
            position: true,
            startsOn: true,
            endsOn: true,
            status: true,
          },
        });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: "ACADEMIC_TERM_CREATED",
            resourceId: term.id,
          },
        });
        return term;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

export async function createCatalogResource(
  schoolId: string,
  kind: "class" | "subject",
  input: unknown,
) {
  if (!id.safeParse(schoolId).success) throw new AcademicConfigError("INVALID_INPUT");
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        const data = { schoolId, name: parsed.data.name, isActive: true };
        const resource =
          kind === "class"
            ? await tx.schoolClass.create({
                data,
                select: { id: true, schoolId: true, name: true, isActive: true },
              })
            : await tx.subject.create({
                data,
                select: { id: true, schoolId: true, name: true, isActive: true },
              });
        await tx.schoolConfigurationEvent.create({
          data: {
            schoolId,
            actorUserId: userId,
            actorMembershipId: actor.membershipId,
            eventType: kind === "class" ? "CLASS_CREATED" : "SUBJECT_CREATED",
            resourceId: resource.id,
          },
        });
        return resource;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

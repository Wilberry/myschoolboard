import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import {
  changeSchoolStatusInput,
  onboardSchoolInput,
  transitionEvent,
} from "./school-lifecycle-policy";

export type PlatformSchoolErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class PlatformSchoolError extends Error {
  constructor(readonly code: PlatformSchoolErrorCode) {
    super(code);
    this.name = "PlatformSchoolError";
  }
}

async function platformActor(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new PlatformSchoolError("UNAUTHENTICATED");
  return session.user.id;
}

async function assertPlatformAdmin(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true },
  });
  if (
    !user ||
    !authorize(
      {
        userId: user.id,
        platformRole: user.platformRole,
        membership: null,
      },
      "platform:manage",
    ).allowed
  ) {
    throw new PlatformSchoolError("FORBIDDEN");
  }
}

function mapPersistenceError(error: unknown): never {
  if (error instanceof PlatformSchoolError) throw error;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    throw new PlatformSchoolError("CONFLICT");
  }
  throw new PlatformSchoolError("INTERNAL");
}

/**
 * Onboarding creates a PENDING, non-accessible school. No staff/administrator
 * identity is inferred or invited as a side effect.
 */
export async function onboardSchool(input: unknown) {
  const parsed = onboardSchoolInput.safeParse(input);
  if (!parsed.success) throw new PlatformSchoolError("INVALID_INPUT");
  const actorId = await platformActor();

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        const school = await tx.school.create({
          data: {
            name: parsed.data.name,
            slug: parsed.data.slug,
            isActive: false,
            lifecycleStatus: "PENDING",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            lifecycleStatus: true,
          },
        });
        await tx.schoolLifecycleEvent.create({
          data: {
            schoolId: school.id,
            actorUserId: actorId,
            eventType: "ONBOARDED",
            newStatus: "PENDING",
          },
        });
        return school;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapPersistenceError(error);
  }
}

/**
 * Updates the stored lifecycle and the legacy isActive read barrier in the
 * same serializable transaction. Existing unclassified schools cannot be
 * silently reclassified by this operation.
 */
export async function changeSchoolLifecycle(schoolId: string, input: unknown) {
  if (!z.string().trim().min(1).max(128).safeParse(schoolId).success) {
    throw new PlatformSchoolError("INVALID_INPUT");
  }
  const parsed = changeSchoolStatusInput.safeParse(input);
  if (!parsed.success) throw new PlatformSchoolError("INVALID_INPUT");
  const actorId = await platformActor();

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        await tx.$queryRaw`SELECT "id" FROM "School"
          WHERE "id" = ${schoolId} FOR UPDATE`;
        const previous = await tx.school.findUnique({
          where: { id: schoolId },
          select: { lifecycleStatus: true, isActive: true },
        });
        if (!previous) throw new PlatformSchoolError("NOT_FOUND");
        if (!previous.lifecycleStatus) {
          throw new PlatformSchoolError("CONFLICT");
        }
        const eventType = transitionEvent(
          previous.lifecycleStatus,
          parsed.data.status,
        );
        if (!eventType) throw new PlatformSchoolError("CONFLICT");
        const school = await tx.school.update({
          where: { id: schoolId },
          data: {
            lifecycleStatus: parsed.data.status,
            isActive: parsed.data.status === "ACTIVE",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            lifecycleStatus: true,
          },
        });
        await tx.schoolLifecycleEvent.create({
          data: {
            schoolId,
            actorUserId: actorId,
            eventType,
            previousStatus: previous.lifecycleStatus,
            newStatus: parsed.data.status,
            reason: parsed.data.reason,
          },
        });
        return school;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapPersistenceError(error);
  }
}

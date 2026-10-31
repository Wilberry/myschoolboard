import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import {
  assignSchoolSubscriptionInput,
  createPlanRevisionInput,
  observedSubscriptionStatus,
  quotaObservation,
  subscriptionPeriodView,
} from "./subscription-policy";

type SubscriptionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class PlatformSubscriptionError extends Error {
  constructor(readonly code: SubscriptionErrorCode) {
    super(code);
    this.name = "PlatformSubscriptionError";
  }
}

async function platformActor(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new PlatformSubscriptionError("UNAUTHENTICATED");
  return session.user.id;
}

async function assertPlatformAdmin(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
) {
  // Lock the actor during the complete transaction. A concurrent role
  // revocation cannot race between authorization and the final read/write.
  await tx.$queryRaw`SELECT "id" FROM "User"
    WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true },
  });
  if (
    !user ||
    !authorize(
      { userId: user.id, platformRole: user.platformRole, membership: null },
      "platform:manage",
    ).allowed
  ) {
    throw new PlatformSubscriptionError("FORBIDDEN");
  }
}

function translate(error: unknown): never {
  if (error instanceof PlatformSubscriptionError) throw error;
  // PrismaPg may wrap a SQLSTATE inside meta.driverAdapterError or cause.
  // Recognize ONLY uniqueness and transient serialization/deadlock failures.
  const queue: unknown[] = [error];
  const visited = new Set<object>();
  const conflicts = new Set(["P2002", "P2034", "23505", "23P01", "40001", "40P01"]);
  for (let index = 0; index < queue.length && index < 24; index += 1) {
    const node = queue[index];
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const record = node as Record<string, unknown>;
    for (const field of ["code", "sqlState", "originalCode"] as const) {
      const value = record[field];
      if (typeof value === "string" && conflicts.has(value)) {
        throw new PlatformSubscriptionError("CONFLICT");
      }
    }
    for (const field of ["cause", "meta", "driverAdapterError"] as const) {
      const child = record[field];
      if (child && typeof child === "object") queue.push(child);
    }
  }
  // An error may contain SQL/connection details. Never forward it to HTTP.
  throw new PlatformSubscriptionError("INTERNAL");
}

/** Only Platform Super Admins can view the global versioned catalog. */
export async function listPlatformPlans() {
  const actorId = await platformActor();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        return tx.platformPlanRevision.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 100,
          select: {
            id: true,
            code: true,
            version: true,
            name: true,
            features: true,
            maxStudents: true,
            maxStaff: true,
            reason: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    translate(error);
  }
}

/** A revision never edits an earlier catalog version. */
export async function createPlatformPlanRevision(input: unknown) {
  const parsed = createPlanRevisionInput.safeParse(input);
  if (!parsed.success) throw new PlatformSubscriptionError("INVALID_INPUT");
  const actorId = await platformActor();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        return tx.platformPlanRevision.create({
          data: {
            code: parsed.data.code,
            version: 1, // PostgreSQL allocates the authoritative next version.
            name: parsed.data.name,
            features: parsed.data.features,
            maxStudents: parsed.data.maxStudents,
            maxStaff: parsed.data.maxStaff,
            reason: parsed.data.reason,
            actorUserId: actorId,
          },
          select: {
            id: true,
            code: true,
            version: true,
            name: true,
            features: true,
            maxStudents: true,
            maxStaff: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    translate(error);
  }
}

function checkedSchoolId(id: string): string {
  if (!z.string().min(1).max(128).safeParse(id).success) {
    throw new PlatformSubscriptionError("INVALID_INPUT");
  }
  return id;
}

/** Operator-only, bounded school subscription history and derived status. */
export async function listSchoolSubscriptions(schoolId: string) {
  checkedSchoolId(schoolId);
  const actorId = await platformActor();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: { id: true },
        });
        if (!school) throw new PlatformSubscriptionError("NOT_FOUND");
        const periods = await tx.schoolSubscriptionPeriod.findMany({
          where: { schoolId: school.id },
          orderBy: [{ startsAt: "desc" }, { id: "asc" }],
          take: 100,
          select: {
            id: true,
            schoolId: true,
            startsAt: true,
            endsAt: true,
            reason: true,
            createdAt: true,
            planRevision: {
              select: {
                id: true,
                code: true,
                version: true,
                name: true,
                features: true,
                maxStudents: true,
                maxStaff: true,
              },
            },
          },
        });
        const now = new Date();
        return periods.map((period) => ({
          ...period,
          periodStatus: subscriptionPeriodView(
            period.startsAt,
            period.endsAt,
            now,
          ),
        }));
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    translate(error);
  }
}

/**
 * Private platform-operator subscription snapshot.
 *
 * This is an OBSERVATION ONLY, not a School authorization, paid-status,
 * student entitlement, quota enforcement, or suspended-school recovery API.
 * All counts are school-constrained aggregate counts without pupil details.
 */
export async function readSchoolSubscriptionStatus(schoolId: string) {
  checkedSchoolId(schoolId);
  const actorId = await platformActor();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: {
            id: true,
            name: true,
            lifecycleStatus: true,
            isActive: true,
          },
        });
        if (!school) throw new PlatformSubscriptionError("NOT_FOUND");
        const asOf = new Date();
        const selectPeriod = {
          id: true,
          startsAt: true,
          endsAt: true,
          planRevision: {
            select: {
              id: true,
              code: true,
              version: true,
              name: true,
              features: true,
              maxStudents: true,
              maxStaff: true,
            },
          },
        } as const;
        let period = await tx.schoolSubscriptionPeriod.findFirst({
          where: {
            schoolId: school.id,
            startsAt: { lte: asOf },
            endsAt: { gt: asOf },
          },
          orderBy: [{ startsAt: "desc" }, { id: "asc" }],
          select: selectPeriod,
        });
        if (!period) {
          period = await tx.schoolSubscriptionPeriod.findFirst({
            where: { schoolId: school.id, startsAt: { gt: asOf } },
            orderBy: [{ startsAt: "asc" }, { id: "asc" }],
            select: selectPeriod,
          });
        }
        if (!period) {
          period = await tx.schoolSubscriptionPeriod.findFirst({
            where: { schoolId: school.id, endsAt: { lte: asOf } },
            orderBy: [{ endsAt: "desc" }, { id: "asc" }],
            select: selectPeriod,
          });
        }
        const [students, staff] = await Promise.all([
          tx.studentRecord.count({
            where: {
              schoolId: school.id,
              status: "ENROLLED",
              enrollments: {
                some: {
                  schoolId: school.id,
                  status: "ACTIVE",
                  session: { status: "ACTIVE" },
                },
              },
            },
          }),
          tx.membership.count({
            where: {
              schoolId: school.id,
              isActive: true,
              role: {
                in: [
                  "SCHOOL_SUPER_ADMIN",
                  "SCHOOL_ADMIN",
                  "HEAD_OF_SECTION",
                  "PRINCIPAL",
                  "TEACHER",
                  "FORM_TEACHER",
                ],
              },
            },
          }),
        ]);
        const status = observedSubscriptionStatus(
          period?.startsAt ?? null,
          period?.endsAt ?? null,
          asOf,
        );
        const currentPlan = status === "CURRENT"
          ? period?.planRevision ?? null
          : null;
        return {
          asOf: asOf.toISOString(),
          school: {
            id: school.id,
            name: school.name,
            lifecycleStatus: school.lifecycleStatus,
            isActive: school.isActive,
          },
          subscriptionStatus: status,
          observedPeriod: period
            ? {
                id: period.id,
                startsAt: period.startsAt,
                endsAt: period.endsAt,
                planRevision: period.planRevision,
              }
            : null,
          usage: {
            enrolledStudents: quotaObservation(
              students,
              currentPlan?.maxStudents ?? null,
            ),
            activeStaff: quotaObservation(
              staff,
              currentPlan?.maxStaff ?? null,
            ),
          },
          billingStatus: "NOT_TRACKED" as const,
          entitlementEnforcement: "NOT_ENABLED" as const,
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    translate(error);
  }
}

/**
 * An assignment records an explicit immutable, half-open UTC period.
 * It NEVER changes School.isActive or grants academic/guardian privileges.
 */
export async function assignSchoolSubscription(
  schoolId: string,
  input: unknown,
) {
  checkedSchoolId(schoolId);
  const parsed = assignSchoolSubscriptionInput.safeParse(input);
  if (!parsed.success) throw new PlatformSubscriptionError("INVALID_INPUT");
  const actorId = await platformActor();
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertPlatformAdmin(tx, actorId);
        await tx.$queryRaw`SELECT "id" FROM "School"
          WHERE "id" = ${schoolId} FOR UPDATE`;
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: { id: true, lifecycleStatus: true },
        });
        if (!school) throw new PlatformSubscriptionError("NOT_FOUND");
        if (!school.lifecycleStatus || school.lifecycleStatus === "CLOSED") {
          throw new PlatformSubscriptionError("CONFLICT");
        }
        const plan = await tx.platformPlanRevision.findUnique({
          where: { id: parsed.data.planRevisionId },
          select: { id: true },
        });
        if (!plan) throw new PlatformSubscriptionError("NOT_FOUND");
        const overlap = await tx.schoolSubscriptionPeriod.count({
          where: {
            schoolId: school.id,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (overlap !== 0) throw new PlatformSubscriptionError("CONFLICT");
        return tx.schoolSubscriptionPeriod.create({
          data: {
            schoolId: school.id,
            planRevisionId: plan.id,
            startsAt,
            endsAt,
            reason: parsed.data.reason,
            actorUserId: actorId,
          },
          select: {
            id: true,
            schoolId: true,
            planRevisionId: true,
            startsAt: true,
            endsAt: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    translate(error);
  }
}

import { z } from "zod";

/**
 * Phase 3: operator-authored plan metadata. A catalog feature is not a
 * granted school permission until the entitlement-enforcement gate ships.
 */
export const platformPlanFeature = z.enum([
  "ATTENDANCE",
  "LESSONS",
  "ASSESSMENTS",
  "CBT",
]);

export const createPlanRevisionInput = z
  .object({
    code: z
      .string()
      .min(3)
      .max(36)
      .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(3).max(100),
    features: z
      .array(platformPlanFeature)
      .min(1)
      .max(4)
      .refine((features) => new Set(features).size === features.length),
    maxStudents: z.number().int().min(1).max(1_000_000).nullable(),
    maxStaff: z.number().int().min(1).max(1_000_000).nullable(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const assignSchoolSubscriptionInput = z
  .object({
    planRevisionId: z.string().trim().min(1).max(128),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .superRefine((data, ctx) => {
    const startsAt = new Date(data.startsAt).getTime();
    const endsAt = new Date(data.endsAt).getTime();
    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt) ||
      endsAt <= startsAt ||
      endsAt > startsAt + 5 * 365 * 86_400_000
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Subscription dates must form a valid bounded interval",
        path: ["endsAt"],
      });
    }
  });

export type SubscriptionPeriodView = "UPCOMING" | "CURRENT" | "ENDED";

export function subscriptionPeriodView(
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): SubscriptionPeriodView {
  if (now < startsAt) return "UPCOMING";
  if (now >= endsAt) return "ENDED";
  return "CURRENT";
}


/**
 * Advisory observation only: this is NOT an access-control decision.
 * A null limit means the catalog has not specified a quota, not unlimited
 * paid entitlement. Historic/legacy tenants must not be cut off by this data.
 */
export function quotaObservation(used: number, limit: number | null) {
  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    (limit !== null && (!Number.isSafeInteger(limit) || limit < 1))
  ) {
    throw new Error("Invalid subscription usage or advisory limit");
  }
  return {
    used,
    limit,
    exceedsLimit: limit === null ? null : used > limit,
  };
}

export type ObservedSubscriptionStatus =
  | "NONE"
  | "CURRENT"
  | "UPCOMING"
  | "ENDED";

/** Server-clock classification; no implicit renewal or school suspension. */
export function observedSubscriptionStatus(
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): ObservedSubscriptionStatus {
  if (startsAt === null || endsAt === null) return "NONE";
  return subscriptionPeriodView(startsAt, endsAt, now);
}

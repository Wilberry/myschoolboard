import { z } from "zod";
import type {
  SchoolLifecycleEventType,
  SchoolLifecycleStatus,
} from "@prisma/client";

export const schoolName = z.string().trim().min(2).max(160);
export const schoolSlug = z
  .string()
  .min(3)
  .max(72)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const onboardSchoolInput = z
  .object({ name: schoolName, slug: schoolSlug })
  .strict();

export const changeSchoolStatusInput = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED", "CLOSED"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const lifecycleTransitions: Record<
  SchoolLifecycleStatus,
  readonly SchoolLifecycleStatus[]
> = {
  PENDING: ["ACTIVE", "CLOSED"],
  ACTIVE: ["SUSPENDED", "EXPIRED", "CLOSED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  EXPIRED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

export function transitionEvent(
  from: SchoolLifecycleStatus,
  to: SchoolLifecycleStatus,
): SchoolLifecycleEventType | null {
  if (!lifecycleTransitions[from].includes(to)) return null;
  if (to === "CLOSED") return "CLOSED";
  if (to === "SUSPENDED") return "SUSPENDED";
  if (to === "EXPIRED") return "EXPIRED";
  if (from === "PENDING") return "ACTIVATED";
  return "REACTIVATED";
}

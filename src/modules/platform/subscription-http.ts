import { randomUUID } from "node:crypto";
import {
  PlatformSubscriptionError,
  assignSchoolSubscription,
  createPlatformPlanRevision,
  listPlatformPlans,
  listSchoolSubscriptions,
  readSchoolSubscriptionStatus,
} from "./subscription-service";

function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function safeLog(event: string) {
  try {
    console.warn(JSON.stringify({ event, requestId: randomUUID() }));
  } catch {
    // Logging failure must never affect a secure response.
  }
}

function failure(error: unknown): Response {
  if (error instanceof PlatformSubscriptionError) {
    if (error.code === "UNAUTHENTICATED") {
      return response({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      safeLog("platform_subscription_denied");
      return response({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return response({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return response({ error: "Conflict" }, 409);
    }
  }
  safeLog("platform_subscription_failed");
  return response({ error: "Request could not be completed" }, 500);
}

export async function handlePlatformPlansGet() {
  try {
    return response({ plans: await listPlatformPlans() }, 200);
  } catch (error) {
    return failure(error);
  }
}

export async function handlePlatformPlansPost(request: Request) {
  try {
    const input: unknown = await request.json();
    return response(
      { plan: await createPlatformPlanRevision(input) },
      201,
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return response({ error: "Invalid request" }, 400);
    return failure(error);
  }
}

export async function handleSchoolSubscriptionsGet(
  params: Promise<{ schoolId: string }>,
) {
  try {
    const { schoolId } = await params;
    return response(
      { subscriptions: await listSchoolSubscriptions(schoolId) },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleSchoolSubscriptionsPost(
  request: Request,
  params: Promise<{ schoolId: string }>,
) {
  try {
    const { schoolId } = await params;
    const input: unknown = await request.json();
    return response(
      { subscription: await assignSchoolSubscription(schoolId, input) },
      201,
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return response({ error: "Invalid request" }, 400);
    return failure(error);
  }
}

/** Operator-only, no-cache view of effective plan and school-specific totals. */
export async function handleSchoolSubscriptionStatusGet(
  params: Promise<{ schoolId: string }>,
) {
  try {
    const { schoolId } = await params;
    return response(
      { status: await readSchoolSubscriptionStatus(schoolId) },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

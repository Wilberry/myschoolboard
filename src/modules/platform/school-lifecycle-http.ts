import { randomUUID } from "node:crypto";
import {
  PlatformSchoolError,
  changeSchoolLifecycle,
  onboardSchool,
} from "./school-lifecycle-service";

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
    // A failed diagnostic transport cannot affect an authorization decision.
  }
}

function failure(error: unknown): Response {
  if (error instanceof PlatformSchoolError) {
    if (error.code === "UNAUTHENTICATED") {
      return response({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      safeLog("platform_school_denied");
      return response({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return response({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return response({ error: "Conflict" }, 409);
    }
  }
  safeLog("platform_school_failed");
  return response({ error: "Request could not be completed" }, 500);
}

export async function handleSchoolOnboarding(request: Request) {
  try {
    const input = await request.json();
    const school = await onboardSchool(input);
    return response({ school }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return response({ error: "Invalid request" }, 400);
    }
    return failure(error);
  }
}

export async function handleSchoolLifecycleChange(
  request: Request,
  params: Promise<{ schoolId: string }>,
) {
  try {
    const { schoolId } = await params;
    const input = await request.json();
    const school = await changeSchoolLifecycle(schoolId, input);
    return response({ school }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return response({ error: "Invalid request" }, 400);
    }
    return failure(error);
  }
}

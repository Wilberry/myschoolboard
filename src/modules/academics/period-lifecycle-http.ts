import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "./config-service";
import { changeAcademicPeriod } from "./period-lifecycle-service";

function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function handleAcademicPeriodChange(
  request: Request,
  params: Promise<{ schoolId: string; sessionId: string; termId?: string }>,
) {
  try {
    if (new URL(request.url).search) {
      return response({ error: "Invalid request" }, 400);
    }
    const { schoolId, sessionId, termId } = await params;
    const input = await request.json();
    const result = await changeAcademicPeriod(
      schoolId,
      sessionId,
      termId,
      input,
    );
    return response(result, 200);
  } catch (error) {
    if (error instanceof AcademicConfigError) {
      if (error.code === "UNAUTHENTICATED") {
        return response({ error: "Unauthorized" }, 401);
      }
      if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
        return response({ error: "Not found" }, 404);
      }
      if (error.code === "INVALID_INPUT") {
        return response({ error: "Invalid request" }, 400);
      }
      if (error.code === "CONFLICT") {
        return response({ error: "Conflict" }, 409);
      }
    }
    if (error instanceof SyntaxError) {
      return response({ error: "Invalid request" }, 400);
    }
    try {
      console.warn(
        JSON.stringify({
          event: "academic_period_transition_failed",
          requestId: randomUUID(),
        }),
      );
    } catch {
      // Logging failure cannot weaken the generic error response.
    }
    return response({ error: "Request could not be completed" }, 500);
  }
}

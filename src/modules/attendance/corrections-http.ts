import { randomUUID } from "node:crypto";
import { AttendanceError } from "./service";
import {
  requestAttendanceCorrection,
  decideAttendanceCorrection,
} from "./corrections-service";

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function failure(error: unknown): Response {
  if (error instanceof AttendanceError) {
    if (error.code === "UNAUTHENTICATED")
      return reply({ error: "Unauthorized" }, 401);
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return reply({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT")
      return reply({ error: "Invalid request" }, 400);
    if (error.code === "CONFLICT") return reply({ error: "Conflict" }, 409);
  }
  if (error instanceof SyntaxError)
    return reply({ error: "Invalid request" }, 400);
  // No original/proposed pupil marks, pupil names, IDs or reasons in logs.
  try {
    console.warn(
      JSON.stringify({
        event: "attendance_correction_mutation_failed",
        requestId: randomUUID(),
      }),
    );
  } catch {
    // Logging must not expose student information.
  }
  return reply({ error: "Request could not be completed" }, 500);
}
export async function handleAttendanceCorrection(
  request: Request,
  params: Promise<{
    schoolId: string;
    registerId?: string;
    requestId?: string;
  }>,
  action: "request" | "decision",
): Promise<Response> {
  try {
    if (request.method !== "POST" || new URL(request.url).search) {
      return reply({ error: "Invalid request" }, 400);
    }
    const { schoolId, registerId, requestId } = await params;
    const body: unknown = await request.json();
    if (action === "request") {
      if (!registerId) return reply({ error: "Invalid request" }, 400);
      return reply(
        {
          correction: await requestAttendanceCorrection(
            schoolId,
            registerId,
            body,
          ),
        },
        201,
      );
    }
    if (!requestId) return reply({ error: "Invalid request" }, 400);
    return reply(
      {
        decision: await decideAttendanceCorrection(schoolId, requestId, body),
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

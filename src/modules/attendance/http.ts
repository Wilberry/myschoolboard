import { randomUUID } from "node:crypto";
import { AttendanceError, decideAttendance, submitAttendance } from "./service";

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failed(error: unknown): Response {
  if (error instanceof AttendanceError) {
    if (error.code === "UNAUTHENTICATED") return reply({ error: "Unauthorized" }, 401);
    if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
      return reply({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") return reply({ error: "Invalid request" }, 400);
    if (error.code === "CONFLICT") return reply({ error: "Conflict" }, 409);
  }
  if (error instanceof SyntaxError) return reply({ error: "Invalid request" }, 400);
  // Never log a minor's name, attendance mark, admission number or class ID.
  try {
    console.warn(JSON.stringify({ event: "attendance_mutation_failed", requestId: randomUUID() }));
  } catch {
    // Logging itself must not expose sensitive request data.
  }
  return reply({ error: "Request could not be completed" }, 500);
}

export async function handleAttendancePost(
  request: Request,
  params: Promise<{ schoolId: string; registerId?: string }>,
  action: "submit" | "decide",
): Promise<Response> {
  try {
    if (new URL(request.url).search || request.method !== "POST") {
      return reply({ error: "Invalid request" }, 400);
    }
    const { schoolId, registerId } = await params;
    const body: unknown = await request.json();
    if (action === "submit") {
      return reply({ register: await submitAttendance(schoolId, body) }, 201);
    }
    if (!registerId) return reply({ error: "Invalid request" }, 400);
    return reply({ register: await decideAttendance(schoolId, registerId, body) }, 200);
  } catch (error) {
    return failed(error);
  }
}

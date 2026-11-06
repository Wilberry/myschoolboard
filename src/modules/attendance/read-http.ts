import { randomUUID } from "node:crypto";
import { AttendanceError } from "./service";
import {
  readFormTeacherRoster,
  readPendingAttendanceReviews,
} from "./read-service";

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function failure(error: unknown) {
  if (error instanceof AttendanceError) {
    if (error.code === "UNAUTHENTICATED")
      return reply({ error: "Unauthorized" }, 401);
    if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") {
      return reply({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT")
      return reply({ error: "Invalid request" }, 400);
    if (error.code === "CONFLICT") return reply({ error: "Conflict" }, 409);
  }
  try {
    console.warn(
      JSON.stringify({
        event: "attendance_private_read_failed",
        requestId: randomUUID(),
      }),
    );
  } catch {
    // Private student data never enters diagnostic logs.
  }
  return reply({ error: "Request could not be completed" }, 500);
}
export async function handleAttendanceRead(
  request: Request,
  params: Promise<{ schoolId: string; registerId?: string }>,
  mode: "roster" | "review-queue" | "review-detail",
): Promise<Response> {
  try {
    if (request.method !== "GET")
      return reply({ error: "Invalid request" }, 400);
    const url = new URL(request.url);
    const { schoolId, registerId } = await params;
    if (mode === "roster") {
      const keys = [...url.searchParams.keys()];
      if (
        keys.length !== 2 ||
        keys.filter((key) => key === "classId").length !== 1 ||
        keys.filter((key) => key === "sessionId").length !== 1
      ) {
        return reply({ error: "Invalid request" }, 400);
      }
      const classId = url.searchParams.get("classId") ?? "";
      const sessionId = url.searchParams.get("sessionId") ?? "";
      return reply({
        roster: await readFormTeacherRoster(schoolId, classId, sessionId),
      });
    }
    if (url.search || (mode === "review-detail" && !registerId)) {
      return reply({ error: "Invalid request" }, 400);
    }
    const reviews = await readPendingAttendanceReviews(
      schoolId,
      mode === "review-detail" ? registerId : undefined,
    );
    return mode === "review-detail"
      ? reply({ register: reviews[0] })
      : reply({ registers: reviews });
  } catch (error) {
    return failure(error);
  }
}

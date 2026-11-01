import { randomUUID } from "node:crypto";
import { AcademicConfigError } from "@/src/modules/academics/config-service";
import {
  cancelTimetableSlot,
  createTimetableRoom,
  createTimetableSlot,
} from "./service";

function respond(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof AcademicConfigError) {
    if (error.code === "UNAUTHENTICATED") {
      return respond({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return respond({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return respond({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return respond({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return respond({ error: "Invalid request" }, 400);
  }
  try {
    console.warn(
      JSON.stringify({
        event: "timetable_write_failed",
        requestId: randomUUID(),
      }),
    );
  } catch {
    // Diagnostic failure must not leak persistence details or change status.
  }
  return respond({ error: "Request could not be completed" }, 500);
}

export async function handleTimetableWrite(
  request: Request,
  params: Promise<{ schoolId: string; slotId?: string }>,
  kind: "room" | "slot" | "cancel",
) {
  try {
    if (new URL(request.url).search) {
      return respond({ error: "Invalid request" }, 400);
    }
    const { schoolId, slotId } = await params;
    const input = await request.json();
    if (kind === "room") {
      return respond({ room: await createTimetableRoom(schoolId, input) }, 201);
    }
    if (kind === "slot") {
      return respond({ slot: await createTimetableSlot(schoolId, input) }, 201);
    }
    return respond(
      { slot: await cancelTimetableSlot(schoolId, slotId ?? "", input) },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

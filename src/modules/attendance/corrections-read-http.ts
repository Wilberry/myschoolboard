import { randomUUID } from "node:crypto";
import { AttendanceError } from "./service";
import {
  readCorrectableRegisters,
  readCorrectableEntryDetail,
  readPendingCorrectionQueue,
  readPendingCorrectionDetail,
} from "./corrections-read";

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}
function failure(error: unknown): Response {
  if (error instanceof AttendanceError) {
    if (error.code === "UNAUTHENTICATED") return reply({ error: "Unauthorized" }, 401);
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") return reply({ error: "Not found" }, 404);
    if (error.code === "INVALID_INPUT") return reply({ error: "Invalid request" }, 400);
    if (error.code === "CONFLICT") return reply({ error: "Conflict" }, 409);
  }
  try {
    console.warn(JSON.stringify({ event: "attendance_correction_private_read_failed", requestId: randomUUID() }));
  } catch {
    // Never log pupil identity, marks or correction reasons.
  }
  return reply({ error: "Request could not be completed" }, 500);
}
export async function handleCorrectionRead(
  request: Request,
  params: Promise<{ schoolId: string; registerId?: string; requestId?: string }>,
  mode: "registers" | "entries" | "queue" | "detail",
): Promise<Response> {
  try {
    if (request.method !== "GET" || new URL(request.url).search) {
      return reply({ error: "Invalid request" }, 400);
    }
    const { schoolId, registerId, requestId } = await params;
    if (mode === "registers") {
      return reply({ registers: await readCorrectableRegisters(schoolId) });
    }
    if (mode === "entries") {
      if (!registerId) return reply({ error: "Invalid request" }, 400);
      return reply({ register: await readCorrectableEntryDetail(schoolId, registerId) });
    }
    if (mode === "queue") {
      return reply({ corrections: await readPendingCorrectionQueue(schoolId) });
    }
    if (!requestId) return reply({ error: "Invalid request" }, 400);
    return reply({ correction: await readPendingCorrectionDetail(schoolId, requestId) });
  } catch (error) {
    return failure(error);
  }
}

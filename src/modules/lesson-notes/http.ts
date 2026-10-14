import { randomUUID } from "node:crypto";
import {
  createLessonNote,
  LessonNoteError,
  readOwnLessonNotes,
  reviseLessonNote,
  submitLessonNote,
} from "./service";

function respond(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof LessonNoteError) {
    switch (error.code) {
      case "UNAUTHENTICATED":
        return respond({ error: "Unauthorized" }, 401);
      case "FORBIDDEN":
      case "NOT_FOUND":
        return respond({ error: "Not found" }, 404);
      case "INVALID_INPUT":
        return respond({ error: "Invalid request" }, 400);
      case "CONFLICT":
        return respond({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return respond({ error: "Invalid request" }, 400);
  }
  try {
    console.warn(
      JSON.stringify({
        event: "lesson_note_request_failed",
        requestId: randomUUID(),
      }),
    );
  } catch {
    // Do not leak content or actor details via diagnostics.
  }
  return respond({ error: "Request could not be completed" }, 500);
}

export async function handleLessonNoteRequest(
  request: Request,
  params: Promise<{ schoolId: string; noteId?: string }>,
  operation: "create" | "list" | "detail" | "revise" | "submit",
): Promise<Response> {
  try {
    if (new URL(request.url).search) {
      return respond({ error: "Invalid request" }, 400);
    }
    const { schoolId, noteId } = await params;
    if (operation === "list") {
      return respond({ notes: await readOwnLessonNotes(schoolId) });
    }
    if (operation === "detail") {
      return respond({
        note: await readOwnLessonNotes(schoolId, noteId ?? ""),
      });
    }
    const input = await request.json();
    if (operation === "create") {
      return respond({ note: await createLessonNote(schoolId, input) }, 201);
    }
    if (!noteId) return respond({ error: "Invalid request" }, 400);
    if (operation === "revise") {
      return respond({ note: await reviseLessonNote(schoolId, noteId, input) });
    }
    return respond({ note: await submitLessonNote(schoolId, noteId, input) });
  } catch (error) {
    return failure(error);
  }
}

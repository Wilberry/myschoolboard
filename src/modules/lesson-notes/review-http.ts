import { randomUUID } from "node:crypto";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";
import { decideLessonNote, readSubmittedLessonNotes } from "./review-service";

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(error: unknown): Response {
  if (error instanceof LessonNoteError) {
    if (error.code === "UNAUTHENTICATED") {
      return reply({ error: "Unauthorized" }, 401);
    }
    if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
      return reply({ error: "Not found" }, 404);
    }
    if (error.code === "INVALID_INPUT") {
      return reply({ error: "Invalid request" }, 400);
    }
    if (error.code === "CONFLICT") {
      return reply({ error: "Conflict" }, 409);
    }
  }
  if (error instanceof SyntaxError) {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    console.warn(
      JSON.stringify({
        event: "lesson_note_review_failed",
        requestId: randomUUID(),
      }),
    );
  } catch {
    // Do not log student/staff identifiers or content.
  }
  return reply({ error: "Request could not be completed" }, 500);
}

export async function handleReview(
  request: Request,
  params: Promise<{ schoolId: string; noteId?: string }>,
  operation: "queue" | "detail" | "decision",
): Promise<Response> {
  try {
    if (new URL(request.url).search) {
      return reply({ error: "Invalid request" }, 400);
    }
    const { schoolId, noteId } = await params;
    if (operation === "queue") {
      return reply({ notes: await readSubmittedLessonNotes(schoolId) });
    }
    if (!noteId) return reply({ error: "Invalid request" }, 400);
    if (operation === "detail") {
      const [note] = await readSubmittedLessonNotes(schoolId, noteId);
      return reply({ note });
    }
    const decided = await decideLessonNote(
      schoolId,
      noteId,
      await request.json(),
    );
    return reply({ note: decided });
  } catch (error) {
    return failure(error);
  }
}

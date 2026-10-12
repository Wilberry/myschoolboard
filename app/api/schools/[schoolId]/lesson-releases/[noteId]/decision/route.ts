import { decideLessonRelease } from "@/src/modules/lesson-notes/release-service";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";

export async function POST(request: Request,
  { params }: { params: Promise<{ schoolId: string; noteId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (new URL(request.url).search) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    }
    const { schoolId, noteId } = await params;
    return Response.json({ event: await decideLessonRelease(schoolId, noteId, await request.json()) },
      { status: 201, headers });
  } catch (error) {
    const code = error instanceof SyntaxError ? "INVALID_INPUT"
      : error instanceof LessonNoteError ? error.code : "INTERNAL";
    const status = code === "UNAUTHENTICATED" ? 401 : code === "INVALID_INPUT" ? 400
      : code === "NOT_FOUND" || code === "FORBIDDEN" ? 404
      : code === "CONFLICT" ? 409 : 500;
    return Response.json({ error: status === 401 ? "Unauthorized"
      : status === 400 ? "Invalid request" : status === 404 ? "Not found"
      : status === 409 ? "Conflict" : "Request could not be completed" },
      { status, headers });
  }
}

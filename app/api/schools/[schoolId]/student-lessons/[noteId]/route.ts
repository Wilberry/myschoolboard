import { readPupilReleasedLessons } from "@/src/modules/lesson-notes/student-reader";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; noteId: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (new URL(request.url).search)
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers },
      );
    const { schoolId, noteId } = await params;
    const result = await readPupilReleasedLessons(schoolId, noteId);
    return Response.json({ lesson: result[0] }, { headers });
  } catch (error) {
    const status =
      error instanceof LessonNoteError
        ? error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "INVALID_INPUT"
            ? 400
            : error.code === "NOT_FOUND" || error.code === "FORBIDDEN"
              ? 404
              : 500
        : 500;
    return Response.json(
      {
        error:
          status === 401
            ? "Unauthorized"
            : status === 400
              ? "Invalid request"
              : status === 404
                ? "Not found"
                : "Request could not be completed",
      },
      { status, headers },
    );
  }
}

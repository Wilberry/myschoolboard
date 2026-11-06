import { readLessonReleaseQueue } from "@/src/modules/lesson-notes/release-read";
import { LessonNoteError } from "@/src/modules/lesson-notes/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (new URL(request.url).search) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers },
      );
    }
    const { schoolId } = await params;
    return Response.json(
      { notes: await readLessonReleaseQueue(schoolId) },
      { headers },
    );
  } catch (error) {
    const code = error instanceof LessonNoteError ? error.code : "INTERNAL";
    const status =
      code === "UNAUTHENTICATED"
        ? 401
        : code === "INVALID_INPUT"
          ? 400
          : code === "NOT_FOUND" || code === "FORBIDDEN"
            ? 404
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

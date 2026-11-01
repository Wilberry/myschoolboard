import { handleLessonNoteRequest } from "@/src/modules/lesson-notes/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; noteId: string }> },
) {
  return handleLessonNoteRequest(request, params, "detail");
}

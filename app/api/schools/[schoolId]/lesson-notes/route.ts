import { handleLessonNoteRequest } from "@/src/modules/lesson-notes/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleLessonNoteRequest(request, params, "create");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleLessonNoteRequest(request, params, "list");
}

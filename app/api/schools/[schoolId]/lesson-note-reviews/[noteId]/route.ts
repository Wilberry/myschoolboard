import { handleReview } from "@/src/modules/lesson-notes/review-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; noteId: string }> },
) {
  return handleReview(request, params, "detail");
}

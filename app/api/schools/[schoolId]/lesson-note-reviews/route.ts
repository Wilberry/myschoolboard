import { handleReview } from "@/src/modules/lesson-notes/review-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  return handleReview(request, params, "queue");
}

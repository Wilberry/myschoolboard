import { reviewLearningWork } from "@/src/modules/learning-assignments/submissions";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; submissionId: string }> },
) {
  try {
    const { schoolId, submissionId } = await params;
    const result = await reviewLearningWork(
      schoolId,
      submissionId,
      await noticeJson(r),
    );
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

import { transitionLearningAssignment } from "@/src/modules/learning-assignments/service";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; taskId: string }> },
) {
  try {
    const { schoolId, taskId } = await params;
    const result = await transitionLearningAssignment(
      schoolId,
      taskId,
      await noticeJson(r),
    );
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

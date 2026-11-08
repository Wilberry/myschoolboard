import { createLearningAssignment } from "@/src/modules/learning-assignments/service";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const { schoolId } = await params;
    const result = await createLearningAssignment(
      schoolId,
      await noticeJson(r),
    );
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

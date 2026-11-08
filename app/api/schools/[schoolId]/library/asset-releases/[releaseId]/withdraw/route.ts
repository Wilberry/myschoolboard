import { withdrawLearningAsset } from "@/src/modules/learning-resources/assets";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  try {
    const { schoolId, releaseId } = await params;
    return noticeResult(
      await withdrawLearningAsset(schoolId, releaseId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

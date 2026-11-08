import { releaseLearningAsset } from "@/src/modules/learning-resources/assets";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; assetId: string }> },
) {
  try {
    const { schoolId, assetId } = await params;
    return noticeResult(
      await releaseLearningAsset(schoolId, assetId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

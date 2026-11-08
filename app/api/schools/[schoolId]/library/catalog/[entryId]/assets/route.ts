import {
  authorizeLearningUpload,
  uploadLearningAsset,
} from "@/src/modules/learning-resources/assets";
import { readLearningUpload } from "@/src/modules/files/bounded-upload";
import { noticeResult, noticeFailure } from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; entryId: string }> },
) {
  try {
    const { schoolId, entryId } = await params;
    await authorizeLearningUpload(schoolId, entryId);
    return noticeResult(
      await uploadLearningAsset(schoolId, entryId, await readLearningUpload(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

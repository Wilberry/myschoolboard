import { reviewCatalogEntry } from "@/src/modules/learning-resources/catalog";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; entryId: string }> },
) {
  try {
    const { schoolId, entryId } = await params;
    return noticeResult(
      await reviewCatalogEntry(schoolId, entryId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

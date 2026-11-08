import { withdrawNotice } from "@/src/modules/communications/service";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  try {
    const p = await params;
    return noticeResult(
      await withdrawNotice(p.schoolId, p.releaseId, await noticeJson(request)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

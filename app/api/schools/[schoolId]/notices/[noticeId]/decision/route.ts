import { decideNotice } from "@/src/modules/communications/service";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; noticeId: string }> },
) {
  try {
    const p = await params;
    return noticeResult(
      await decideNotice(p.schoolId, p.noticeId, await noticeJson(request)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

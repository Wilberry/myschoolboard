import { replayNoticeEvent } from "@/src/modules/notifications/service";
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
    return noticeResult(
      await replayNoticeEvent((await params).schoolId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

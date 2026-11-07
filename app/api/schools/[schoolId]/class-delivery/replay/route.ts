import { replayClassDelivery } from "@/src/modules/notifications/class-inapp";
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
      await replayClassDelivery((await params).schoolId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

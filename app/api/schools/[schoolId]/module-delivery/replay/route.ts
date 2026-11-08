import { replayModuleDelivery } from "@/src/modules/notifications/module-inapp";
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
      await replayModuleDelivery((await params).schoolId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

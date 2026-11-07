import { changeClassNotification } from "@/src/modules/notifications/class-inapp";
import {
  noticeJson,
  noticeResult,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; deliveryId: string }> },
) {
  try {
    const { schoolId, deliveryId } = await params;
    return noticeResult(
      await changeClassNotification(schoolId, deliveryId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

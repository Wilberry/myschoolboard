import { changeNotification } from "@/src/modules/notifications/service";
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
    const p = await params;
    return noticeResult(
      await changeNotification(p.schoolId, p.deliveryId, await noticeJson(r)),
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

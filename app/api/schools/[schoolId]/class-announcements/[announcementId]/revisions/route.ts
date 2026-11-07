import { reviseClassAnnouncement } from "@/src/modules/communications/class-announcements";
import {
  noticeFailure,
  noticeJson,
  noticeResult,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; announcementId: string }> },
) {
  try {
    const { schoolId, announcementId } = await params;
    const result = await reviseClassAnnouncement(
      schoolId,
      announcementId,
      await noticeJson(r),
    );
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

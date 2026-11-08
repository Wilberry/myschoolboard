import { createClassAnnouncement } from "@/src/modules/communications/class-announcements";
import {
  noticeFailure,
  noticeJson,
  noticeResult,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const { schoolId } = await params;
    const result = await createClassAnnouncement(schoolId, await noticeJson(r));
    return noticeResult(result);
  } catch (e) {
    return noticeFailure(e);
  }
}

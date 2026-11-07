import { classAnnouncementWorkspace } from "@/src/modules/communications/class-announcements";
import {
  noticeHeaders,
  noticeFailure,
  noticeQuery,
} from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    noticeQuery(r);
    const { schoolId } = await params;
    const result = await classAnnouncementWorkspace(schoolId);
    return Response.json(result, { headers: noticeHeaders });
  } catch (e) {
    return noticeFailure(e);
  }
}

import { readClassAnnouncements } from "@/src/modules/communications/class-announcements";
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
    const q = noticeQuery(r, ["releaseId"]);
    const { schoolId } = await params;
    const result = await readClassAnnouncements(
      schoolId,
      q.get("releaseId") ?? undefined,
    );
    return Response.json(result, { headers: noticeHeaders });
  } catch (e) {
    return noticeFailure(e);
  }
}

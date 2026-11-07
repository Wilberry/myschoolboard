import { readInbox } from "@/src/modules/notifications/service";
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
    const inbox = await readInbox((await params).schoolId, undefined, 1);
    return Response.json(
      { unreadCount: inbox.unreadCount },
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

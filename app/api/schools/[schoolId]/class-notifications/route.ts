import { readClassInbox } from "@/src/modules/notifications/class-inapp";
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
    const q = noticeQuery(r, ["cursor"]);
    return Response.json(
      await readClassInbox(
        (await params).schoolId,
        q.get("cursor") ?? undefined,
      ),
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

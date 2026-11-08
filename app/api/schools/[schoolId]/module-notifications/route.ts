import { readModuleInbox } from "@/src/modules/notifications/module-inapp";
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
      await readModuleInbox(
        (await params).schoolId,
        q.get("cursor") ?? undefined,
      ),
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

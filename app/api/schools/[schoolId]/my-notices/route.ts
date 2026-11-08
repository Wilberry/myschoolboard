import { readNoticeFeed } from "@/src/modules/communications/service";
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
    const p = noticeQuery(r, ["releaseId"]);
    return Response.json(
      {
        notices: await readNoticeFeed(
          (await params).schoolId,
          p.get("releaseId") ?? undefined,
        ),
      },
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

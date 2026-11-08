import { readInbox } from "@/src/modules/notifications/service";
import { NoticeError } from "@/src/modules/communications/service";
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
    const p = noticeQuery(r, ["cursor", "limit"]);
    const value = p.get("limit");
    if (value !== null && !/^[1-9][0-9]?$/.test(value))
      throw new NoticeError("INVALID_INPUT");
    return Response.json(
      await readInbox(
        (await params).schoolId,
        p.get("cursor") ?? undefined,
        value ? Number(value) : 50,
      ),
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

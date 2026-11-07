import { noticeWorkspace } from "@/src/modules/communications/service";
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
    return Response.json(await noticeWorkspace(schoolId), {
      headers: noticeHeaders,
    });
  } catch (e) {
    return noticeFailure(e);
  }
}

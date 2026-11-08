import { libraryWorkspace } from "@/src/modules/learning-resources/catalog";
import {
  noticeQuery,
  noticeHeaders,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    noticeQuery(r);
    return Response.json(await libraryWorkspace((await params).schoolId), {
      headers: noticeHeaders,
    });
  } catch (e) {
    return noticeFailure(e);
  }
}

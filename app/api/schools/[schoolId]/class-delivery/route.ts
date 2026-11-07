import { runClassDelivery } from "@/src/modules/notifications/class-inapp";
import {
  noticeJson,
  noticeHeaders,
  noticeFailure,
} from "@/src/modules/communications/http";
import { z } from "zod";
import { NoticeError } from "@/src/modules/communications/service";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    z.object({})
      .strict()
      .parse(await noticeJson(r));
    return Response.json(await runClassDelivery((await params).schoolId), {
      headers: noticeHeaders,
    });
  } catch (e) {
    return noticeFailure(e);
  }
}

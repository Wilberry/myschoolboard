import { runModuleDelivery } from "@/src/modules/notifications/module-inapp";
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
    if (
      !z
        .object({})
        .strict()
        .safeParse(await noticeJson(r)).success
    )
      throw new NoticeError("INVALID_INPUT");
    return Response.json(await runModuleDelivery((await params).schoolId), {
      headers: noticeHeaders,
    });
  } catch (e) {
    return noticeFailure(e);
  }
}

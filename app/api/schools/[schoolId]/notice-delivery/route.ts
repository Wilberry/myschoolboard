import { z } from "zod";
import { deliverNoticeBatch } from "@/src/modules/notifications/service";
import {
  NoticeError,
  noticeActor,
  noticeStaff,
  noticeTransaction,
} from "@/src/modules/communications/service";
import {
  noticeJson,
  noticeHeaders,
  noticeFailure,
} from "@/src/modules/communications/http";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const input = z
      .object({})
      .strict()
      .safeParse(await noticeJson(r));
    if (!input.success) throw new NoticeError("INVALID_INPUT");
    const s = (await params).schoolId,
      u = await noticeActor();
    await noticeTransaction(async (tx) => {
      await noticeStaff(tx, s, u, true);
    });
    return Response.json(
      { result: await deliverNoticeBatch(s, u) },
      { headers: noticeHeaders },
    );
  } catch (e) {
    return noticeFailure(e);
  }
}

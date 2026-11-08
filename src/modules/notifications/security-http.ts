import { env } from "@/src/lib/env";
import { NoticeError } from "@/src/modules/communications/service";
import {
  readSecurityInbox,
  changeSecurityNotification,
  runSecurityDelivery,
  replaySecurityDelivery,
  type SecurityChannel,
} from "./security-inapp";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: unknown) {
  const status =
    error instanceof NoticeError
      ? error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "INVALID_INPUT"
          ? 400
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "CONFLICT"
              ? 409
              : 500
      : 500;
  return Response.json(
    {
      error:
        status === 401
          ? "Unauthorized"
          : status === 400
            ? "Invalid request"
            : status === 404
              ? "Not found"
              : status === 409
                ? "Conflict"
                : "Request could not be completed",
    },
    { status, headers },
  );
}
async function input(request: Request) {
  if (
    new URL(request.url).search ||
    request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin ||
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    throw new NoticeError("INVALID_INPUT");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096))
    throw new NoticeError("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new NoticeError("INVALID_INPUT");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let total = 0,
          text = "";
        const decoder = new TextDecoder("utf-8", { fatal: true });
        for (;;) {
          const part = await reader.read();
          if (part.done) return JSON.parse(text + decoder.decode());
          total += part.value.byteLength;
          if (total > 4096) throw new NoticeError("INVALID_INPUT");
          text += decoder.decode(part.value, { stream: true });
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new NoticeError("INVALID_INPUT")),
          5000,
        );
      }),
    ]);
  } catch {
    throw new NoticeError("INVALID_INPUT");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
export async function securityInboxGET(
  request: Request,
  channel: SecurityChannel,
) {
  try {
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((k) => k !== "cursor") ||
      query.getAll("cursor").length > 1
    )
      throw new NoticeError("INVALID_INPUT");
    return Response.json(
      await readSecurityInbox(channel, query.get("cursor") ?? undefined),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function securityWrite(
  request: Request,
  operation: "DELIVER" | "REPLAY" | "STATE",
  channel?: SecurityChannel,
  id?: string,
) {
  try {
    const body = await input(request);
    if (operation === "DELIVER")
      return Response.json(await runSecurityDelivery(body), { headers });
    const result =
      operation === "REPLAY"
        ? await replaySecurityDelivery(body)
        : await changeSecurityNotification(channel!, id!, body);
    return Response.json(
      { result },
      { status: result.replay ? 200 : 201, headers },
    );
  } catch (error) {
    return failure(error);
  }
}

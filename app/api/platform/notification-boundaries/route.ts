import { env } from "@/src/lib/env";
import { NoticeError } from "@/src/modules/communications/service";
import {
  captureSubscriptionBoundaries,
  readPlatformOperationalEvidence,
} from "@/src/modules/notifications/subscription-boundaries";
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
            : 500
      : 500;
  return Response.json(
    {
      error:
        status === 401
          ? "Unauthorized"
          : status === 404
            ? "Not found"
            : status === 400
              ? "Invalid request"
              : "Request could not be completed",
    },
    { status, headers },
  );
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((k) => k !== "cursor" && k !== "schoolId") ||
      query.getAll("cursor").length > 1 ||
      query.getAll("schoolId").length !== 1
    )
      throw new NoticeError("INVALID_INPUT");
    return Response.json(
      await readPlatformOperationalEvidence(
        query.get("schoolId") ?? "",
        query.get("cursor") ?? undefined,
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    if (
      new URL(request.url).search ||
      request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      throw new NoticeError("INVALID_INPUT");
    const text = await smallBody(request);
    if (text.trim() !== "{}") throw new NoticeError("INVALID_INPUT");
    return Response.json(await captureSubscriptionBoundaries(), { headers });
  } catch (error) {
    return failure(error);
  }
}

async function smallBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new NoticeError("INVALID_INPUT");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let text = "",
          size = 0;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) return text;
          size += chunk.value.byteLength;
          if (size > 20) throw new NoticeError("INVALID_INPUT");
          text += new TextDecoder().decode(chunk.value);
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new NoticeError("INVALID_INPUT")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

import { env } from "@/src/lib/env";
import { TrashError } from "./service";
export const trashHeaders = {
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};
export function trashFailure(e: unknown) {
  const code =
    e instanceof SyntaxError
      ? "INVALID_INPUT"
      : e instanceof TrashError
        ? e.code
        : "INTERNAL";
  const status =
    code === "INVALID_INPUT"
      ? 400
      : code === "UNAUTHENTICATED"
        ? 401
        : code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
            : 500;
  return Response.json(
    {
      error:
        status === 400
          ? "Invalid request"
          : status === 401
            ? "Unauthorized"
            : status === 404
              ? "Not found"
              : status === 409
                ? "Conflict"
                : "Request failed",
    },
    { status, headers: trashHeaders },
  );
}
export function validateTrashRequest(request: Request, mutation = false) {
  if (
    new URL(request.url).search ||
    (mutation &&
      request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin) ||
    (mutation &&
      !/^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?\s*$/i.test(
        request.headers.get("content-type") ?? "",
      ))
  )
    throw new TrashError("INVALID_INPUT");
}

/**
 * Bound untrusted mutation bodies before JSON parsing. The declared length is
 * advisory; the streamed byte count is authoritative. No private request body
 * or parser exception is written to diagnostics.
 */
export async function readTrashMutation(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 4096))
    throw new TrashError("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new TrashError("INVALID_INPUT");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let bytes = 0;
        let text = "";
        const decoder = new TextDecoder("utf-8", { fatal: true });
        for (;;) {
          const part = await reader.read();
          if (part.done) {
            if (declared !== null && bytes !== Number(declared))
              throw new TrashError("INVALID_INPUT");
            return JSON.parse(text + decoder.decode()) as unknown;
          }
          bytes += part.value.byteLength;
          if (bytes > 4096) throw new TrashError("INVALID_INPUT");
          text += decoder.decode(part.value, { stream: true });
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TrashError("INVALID_INPUT")), 5000);
      }),
    ]);
  } catch {
    throw new TrashError("INVALID_INPUT");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

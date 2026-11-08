import { env } from "@/src/lib/env";
import { NoticeError } from "@/src/modules/communications/service";
/** Bound actual multipart bytes before parsing; no path, URL or trusted length. */
export async function readLearningUpload(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const origin = request.headers.get("origin");
  if (
    origin !== new URL(env.BETTER_AUTH_URL).origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !/^multipart\/form-data;\s*boundary=/i.test(type) ||
    new URL(request.url).search
  )
    throw new NoticeError("INVALID_INPUT");
  const limit = 5 * 1024 * 1024 + 65536,
    declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || BigInt(declared) > BigInt(limit))
  ) {
    void request.body?.cancel().catch(() => {});
    throw new NoticeError("INVALID_INPUT");
  }
  if (!request.body) throw new NoticeError("INVALID_INPUT");
  const reader = request.body.getReader();
  let interrupted = request.signal.aborted;
  const abort = () => {
    interrupted = true;
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(abort, 10000);
  request.signal.addEventListener("abort", abort, { once: true });
  if (interrupted) abort();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new NoticeError("INVALID_INPUT");
      }
      chunks.push(r.value);
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  if (interrupted) throw new NoticeError("INVALID_INPUT");
  const all = new Uint8Array(size);
  let pos = 0;
  for (const chunk of chunks) {
    all.set(chunk, pos);
    pos += chunk.byteLength;
  }
  let form: FormData;
  try {
    form = await new Response(all, {
      headers: { "content-type": type },
    }).formData();
  } catch {
    throw new NoticeError("INVALID_INPUT");
  }
  const names = ["file", "expectedRevision", "reason", "requestKey"];
  for (const name of form.keys())
    if (!names.includes(name) || form.getAll(name).length !== 1)
      throw new NoticeError("INVALID_INPUT");
  if (names.some((n) => !form.has(n))) throw new NoticeError("INVALID_INPUT");
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg"].includes(file.type)
  )
    throw new NoticeError("INVALID_INPUT");
  return {
    file,
    expectedRevision: form.get("expectedRevision"),
    reason: form.get("reason"),
    requestKey: form.get("requestKey"),
  };
}

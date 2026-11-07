/** Bound private JSON bytes before decoding/parsing. No trusted Content-Length,
 * payload logging, JSON reviver or caller-controlled size override. Callers keep
 * their existing content-type and authorization contracts. */
export async function readBoundedJson(request: Request): Promise<unknown> {
  const limit = 64 * 1024;
  const declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || BigInt(declared) > BigInt(limit))
  ) {
    void request.body?.cancel().catch(() => {});
    throw new SyntaxError("Invalid request");
  }
  if (!request.body) throw new SyntaxError("Invalid request");
  const reader = request.body.getReader();
  let interrupted = request.signal.aborted;
  const interrupt = () => {
    interrupted = true;
    void reader.cancel().catch(() => {});
  };
  const deadline = setTimeout(interrupt, 10000);
  request.signal.addEventListener("abort", interrupt, { once: true });
  if (interrupted) interrupt();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new SyntaxError("Invalid request");
      }
      chunks.push(next.value);
    }
  } finally {
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", interrupt);
    reader.releaseLock();
  }
  if (interrupted) throw new SyntaxError("Invalid request");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SyntaxError("Invalid request");
  }
}

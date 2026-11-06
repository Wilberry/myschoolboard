import { env } from "@/src/lib/env";
import { attachPaymentImage } from "@/src/modules/fees/payment-attachment-service";
import { FeeError } from "@/src/modules/fees/fee-configuration-service";
import {
  financialHeaders,
  financialError,
} from "@/src/modules/fees/financial-http";
/** Bound the stream before parsing multipart; do not trust Content-Length. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const type = request.headers.get("content-type");
    if (
      request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin ||
      new URL(request.url).search ||
      !type?.toLowerCase().startsWith("multipart/form-data;") ||
      !request.body
    )
      throw new FeeError("INVALID_INPUT");
    const reader = request.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 5 * 1024 * 1024 + 65536) {
          await reader.cancel();
          throw new FeeError("INVALID_INPUT");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": type },
      }).formData();
    } catch {
      throw new FeeError("INVALID_INPUT");
    }
    for (const key of form.keys())
      if (
        !["evidenceId", "requestKey", "file"].includes(key) ||
        form.getAll(key).length !== 1
      )
        throw new FeeError("INVALID_INPUT");
    const evidenceId = form.get("evidenceId"),
      requestKey = form.get("requestKey"),
      file = form.get("file");
    if (
      typeof evidenceId !== "string" ||
      typeof requestKey !== "string" ||
      !(file instanceof File)
    )
      throw new FeeError("INVALID_INPUT");
    const attachment = await attachPaymentImage(
      (await params).schoolId,
      evidenceId,
      requestKey,
      file,
    );
    return Response.json(
      { attachment, status: "PENDING_REVIEW_EVIDENCE_ONLY" },
      { status: attachment.replay ? 200 : 201, headers: financialHeaders },
    );
  } catch (e) {
    return financialError(e);
  }
}

import { readLearningAsset } from "@/src/modules/learning-resources/assets";
import {
  noticeHeaders,
  noticeFailure,
  noticeQuery,
} from "@/src/modules/communications/http";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  try {
    noticeQuery(r);
    if (r.headers.has("range"))
      return new Response(null, { status: 404, headers: noticeHeaders });
    const { schoolId, releaseId } = await params;
    const data = await readLearningAsset(schoolId, releaseId);
    return new Response(new Uint8Array(data), {
      headers: {
        ...noticeHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="learning-resource-${releaseId}.png"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Content-Length": String(data.length),
      },
    });
  } catch (e) {
    return noticeFailure(e);
  }
}
export async function HEAD(
  r: Request,
  context: { params: Promise<{ schoolId: string; releaseId: string }> },
) {
  const response = await GET(r, context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

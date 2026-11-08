import { NoticeError } from "./service";
import { readBoundedJson } from "@/src/lib/request-json";
export const noticeHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};
export function noticeFailure(e: unknown) {
  const code =
    e instanceof SyntaxError
      ? "INVALID_INPUT"
      : e instanceof NoticeError
        ? e.code
        : "INTERNAL";
  const status =
    code === "RATE_LIMITED"
      ? 429
      : code === "INVALID_INPUT"
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
        status === 429
          ? "Request limit reached"
          : status === 400
            ? "Invalid request"
            : status === 401
              ? "Unauthorized"
              : status === 404
                ? "Not found"
                : status === 409
                  ? "Conflict"
                  : "Request failed",
    },
    { status, headers: noticeHeaders },
  );
}
export async function noticeJson(r: Request) {
  if (
    new URL(r.url).search ||
    !r.headers.get("content-type")?.toLowerCase().startsWith("application/json")
  )
    throw new NoticeError("INVALID_INPUT");
  return readBoundedJson(r);
}
export function noticeQuery(r: Request, names: string[] = []) {
  const p = new URL(r.url).searchParams;
  for (const name of p.keys())
    if (!names.includes(name) || p.getAll(name).length !== 1)
      throw new NoticeError("INVALID_INPUT");
  return p;
}
export function noticeResult(result: { replay: boolean }) {
  return Response.json(
    { result },
    { status: result.replay ? 200 : 201, headers: noticeHeaders },
  );
}

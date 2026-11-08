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
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json"))
  )
    throw new TrashError("INVALID_INPUT");
}

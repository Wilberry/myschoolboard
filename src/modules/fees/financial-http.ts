import { FeeError } from "./fee-configuration-service";
export const financialHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};
export function financialError(e: unknown) {
  const code =
    e instanceof SyntaxError
      ? "INVALID_INPUT"
      : e instanceof FeeError
        ? e.code
        : "INTERNAL";
  const status =
    code === "UNAUTHENTICATED"
      ? 401
      : code === "INVALID_INPUT"
        ? 400
        : code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
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
                : "Request failed",
    },
    { status, headers: financialHeaders },
  );
}
export function financialJson(request: Request) {
  if (
    new URL(request.url).search ||
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new FeeError("INVALID_INPUT");
}
export function financialQuery(request: Request, name: string) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((k) => k !== name) ||
    params.getAll(name).length > 1
  )
    throw new FeeError("INVALID_INPUT");
  const value = params.get(name);
  if (
    value !== null &&
    (!value || value.length > 128 || value !== value.trim())
  )
    throw new FeeError("INVALID_INPUT");
  return value ?? undefined;
}

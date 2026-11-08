import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import {
  NoticeError,
  noticeTransaction,
} from "@/src/modules/communications/service";
import { authenticationEvidenceEnabled } from "./auth-security-evidence";
const cursorSchema = z
  .object({
    at: z.string().datetime({ precision: 6 }),
    id: z.string().uuid(),
    scope: z.enum(["SELF", "PLATFORM"]),
  })
  .strict();
export async function readAuthenticationEvidence(
  scope: "SELF" | "PLATFORM",
  cursor?: string,
) {
  if (!authenticationEvidenceEnabled()) throw new NoticeError("NOT_FOUND");
  let position: z.infer<typeof cursorSchema> | undefined;
  if (cursor !== undefined) {
    if (!cursor || cursor.length > 500 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new NoticeError("INVALID_INPUT");
    try {
      position = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new NoticeError("INVALID_INPUT");
    }
  }
  if (position && position.scope !== scope)
    throw new NoticeError("INVALID_INPUT");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new NoticeError("UNAUTHENTICATED");
  return noticeTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${session.user.id} FOR UPDATE`;
    const actor = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true },
    });
    if (
      !actor ||
      (scope === "PLATFORM" && actor.platformRole !== "SUPER_ADMIN")
    )
      throw new NoticeError("NOT_FOUND");
    if (position) {
      const existing = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "AuthSecurityEvidence" WHERE "id"=${position.id}::uuid AND "recordedAt"=${position.at}::timestamptz AND (${scope}='PLATFORM' OR "subjectUserId"=${session.user.id})`;
      if (!existing.length) throw new NoticeError("NOT_FOUND");
    }
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        kind: string;
        method: string;
        at: string;
        subjectUserId: string | null;
        actorUserId: string | null;
      }>
    >`
   SELECT "id","kind","method","subjectUserId","actorUserId",to_char("recordedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
   FROM "AuthSecurityEvidence" WHERE (${scope}='PLATFORM' OR "subjectUserId"=${session.user.id})
   AND (${position?.id ?? null}::uuid IS NULL OR ("recordedAt","id")<(${position?.at ?? null}::timestamptz,${position?.id ?? null}::uuid))
   ORDER BY "recordedAt" DESC,"id" DESC LIMIT 101`;
    const more = rows.length > 100;
    if (more) rows.pop();
    const last = rows.at(-1);
    return {
      evidence: rows,
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({ at: last.at, id: last.id, scope }),
            ).toString("base64url")
          : null,
    };
  });
}
export async function authenticationEvidenceGET(
  request: Request,
  scope: "SELF" | "PLATFORM",
) {
  const responseHeaders = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((k) => k !== "cursor") ||
      query.getAll("cursor").length > 1
    )
      throw new NoticeError("INVALID_INPUT");
    return Response.json(
      await readAuthenticationEvidence(scope, query.get("cursor") ?? undefined),
      { headers: responseHeaders },
    );
  } catch (error) {
    const status =
      error instanceof NoticeError
        ? error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "INVALID_INPUT"
              ? 400
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
      { status, headers: responseHeaders },
    );
  }
}

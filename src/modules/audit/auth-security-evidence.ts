import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/src/lib/db";
export const authHTTPAudit = new AsyncLocalStorage<boolean>();
export function authenticationEvidenceEnabled() {
  return process.env.PHASE10_AUTH_SECURITY_ENABLED === "true";
}
export type AuthenticationMethod =
  "EMAIL_SIGN_IN" | "EMAIL_SIGN_UP" | "SIGN_OUT";
export function authenticationMethod(
  path: string,
): AuthenticationMethod | undefined {
  return path === "/sign-in/email"
    ? "EMAIL_SIGN_IN"
    : path === "/sign-up/email"
      ? "EMAIL_SIGN_UP"
      : path === "/sign-out"
        ? "SIGN_OUT"
        : undefined;
}
export async function appendAuthenticationEvidence(
  kind:
    | "AUTH_SUCCEEDED"
    | "AUTH_FAILED"
    | "LOGOUT_REQUESTED"
    | "LOGOUT_COMPLETED"
    | "LOGOUT_FAILED",
  method: AuthenticationMethod,
  subject?: { userId: string; sessionId: string },
) {
  // Only fixed categories and server-authenticated identity/session record IDs.
  // No caller body/header/query/log text is accepted or persisted.
  await prisma.authSecurityEvidence.create({
    data: {
      kind,
      method,
      subjectUserId: subject?.userId,
      actorUserId: subject?.userId,
      sessionRecordId: subject?.sessionId,
    },
  });
}

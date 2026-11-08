import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "@/src/lib/db";
import {
  authenticationEvidenceEnabled,
  authenticationMethod,
  appendAuthenticationEvidence,
  authHTTPAudit,
} from "@/src/modules/audit/auth-security-evidence";
type Logout = { userId: string; sessionId: string };
function unavailable(): never {
  throw new APIError("INTERNAL_SERVER_ERROR", {
    message: "Authentication operation could not be completed",
  });
}
export const authenticationSecurityHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (!authenticationEvidenceEnabled() || ctx.path !== "/sign-out") return;
    try {
      const token = await ctx.getSignedCookie(
        ctx.context.authCookies.sessionToken.name,
        ctx.context.secret,
      );
      const session = token
        ? await ctx.context.internalAdapter.findSession(token)
        : null;
      if (
        !session ||
        new Date(session.session.expiresAt).getTime() <= Date.now()
      )
        return;
      const logout: Logout = {
        userId: session.user.id,
        sessionId: session.session.id,
      };
      await appendAuthenticationEvidence(
        "LOGOUT_REQUESTED",
        "SIGN_OUT",
        logout,
      );
      return { context: { context: { phase10Logout: logout } } };
    } catch {
      unavailable();
    }
  }),
  after: createAuthMiddleware(async (ctx) => {
    if (!authenticationEvidenceEnabled()) return;
    const method = authenticationMethod(ctx.path);
    if (!method) return;
    try {
      const logout = (
        ctx.context as typeof ctx.context & { phase10Logout?: Logout }
      ).phase10Logout;
      if (method === "SIGN_OUT" && logout) {
        // BetterAuth catches delete failures. Never confirm sign-out while the
        // original server session still exists and can authenticate another client.
        const exists = await prisma.session.count({
          where: { id: logout.sessionId, userId: logout.userId },
        });
        await appendAuthenticationEvidence(
          exists ? "LOGOUT_FAILED" : "LOGOUT_COMPLETED",
          method,
          logout,
        );
        if (exists) unavailable();
      } else if (ctx.context.returned instanceof APIError) {
        if (!authHTTPAudit.getStore())
          await appendAuthenticationEvidence("AUTH_FAILED", method);
      } else if (ctx.context.newSession && method !== "SIGN_OUT") {
        const session = ctx.context.newSession;
        await appendAuthenticationEvidence("AUTH_SUCCEEDED", method, {
          userId: session.user.id,
          sessionId: session.session.id,
        });
      }
    } catch {
      // Do not leave a usable newly-created session after its mandatory
      // success audit failed. Its database creation/end evidence remains.
      const created = ctx.context.newSession;
      if (created && method !== "SIGN_OUT") {
        try {
          await prisma.session.deleteMany({
            where: { id: created.session.id, userId: created.user.id },
          });
        } catch {
          console.error(
            JSON.stringify({
              event: "authentication_session_compensation_unavailable",
            }),
          );
        }
      }
      unavailable();
    }
  }),
};

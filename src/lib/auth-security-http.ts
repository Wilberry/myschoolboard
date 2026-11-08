import {
  authenticationEvidenceEnabled,
  authenticationMethod,
  appendAuthenticationEvidence,
  authHTTPAudit,
} from "@/src/modules/audit/auth-security-evidence";
export async function auditedAuthenticationHTTP(
  request: Request,
  handler: (request: Request) => Promise<Response>,
) {
  const enabled = authenticationEvidenceEnabled();
  return authHTTPAudit.run(true, async () => {
    try {
      const response = await handler(request);
      const method = authenticationMethod(
        new URL(request.url).pathname.replace(/^\/api\/auth/, ""),
      );
      if (enabled && method && response.status >= 400)
        await appendAuthenticationEvidence("AUTH_FAILED", method);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "private, no-store");
      headers.set("Vary", "Cookie");
      // A failed mandatory audit must never return a newly minted auth cookie.
      if (response.status >= 400) headers.delete("set-cookie");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      console.error(
        JSON.stringify({ event: "authentication_audit_operation_unavailable" }),
      );
      return Response.json(
        { error: "Authentication operation could not be completed" },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
        },
      );
    }
  });
}

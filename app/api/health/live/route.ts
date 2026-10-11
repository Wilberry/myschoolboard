/**
 * A public, dependency-free liveness probe. It proves only that the Next.js
 * handler responds, never database readiness, identity status, or tenant health.
 */
export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

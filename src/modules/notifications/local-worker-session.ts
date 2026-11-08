import { z } from "zod";
const sessionSchema = z.object({
  user: z.object({ id: z.string().min(1) }),
  session: z.object({
    userId: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }),
  }),
});
// Call only after disposable database attestation. Authentication is delegated
// to the actual local test app, preserving its secure-cookie configuration.
export async function currentLocalWorkerUser(cookie: string) {
  const base = new URL(process.env.BETTER_AUTH_URL ?? "");
  if (
    !["http://localhost:3001", "http://127.0.0.1:3001"].includes(base.origin) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw Error("Explicit isolated local app required");
  const response = await fetch(new URL("/api/auth/get-session", base), {
    headers: { cookie, "cache-control": "no-store" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error("Operator authentication unavailable");
  const parsed = sessionSchema.safeParse(await response.json());
  if (
    !parsed.success ||
    parsed.data.user.id !== parsed.data.session.userId ||
    !Number.isFinite(Date.parse(parsed.data.session.expiresAt)) ||
    Date.parse(parsed.data.session.expiresAt) <= Date.now()
  )
    throw Error("Current operator session required");
  return parsed.data.user.id;
}

import { afterEach, it, expect, vi } from "vitest";
import { currentLocalWorkerUser } from "./local-worker-session";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("never forwards an operator cookie outside the explicit isolated app", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const base of [
    "https://school.example",
    "http://localhost:3001.evil.example",
    "http://user:password@localhost:3001",
    "http://localhost:3001/other",
    "http://localhost:3001?redirect=https://evil.example",
    "http://localhost:3002",
  ]) {
    vi.stubEnv("BETTER_AUTH_URL", base);
    await expect(
      currentLocalWorkerUser("synthetic-cookie-only"),
    ).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects mismatched, expired and malformed authoritative session responses", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001");
  for (const session of [
    {
      userId: "other",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    { userId: "actor", expiresAt: new Date(0).toISOString() },
    { userId: "actor", expiresAt: "invalid-date" },
  ]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ user: { id: "actor" }, session })),
    );
    await expect(
      currentLocalWorkerUser("synthetic-cookie-only"),
    ).rejects.toThrow();
  }
});

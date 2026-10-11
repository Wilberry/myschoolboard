import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/health/live/route";

describe("public liveness endpoint", () => {
  it("responds without requesting an identity, tenant, or database", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("never includes server internals in its response", async () => {
    const response = GET();
    const body = await response.text();
    expect(body).not.toMatch(/database|secret|token|tenant|version|error/i);
  });
});

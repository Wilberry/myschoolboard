import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("private Phase 8 page response headers", () => {
  it("applies no-store and no-index headers to every sensitive school page", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const entries = await nextConfig.headers!();
    const expected = [
      "/schools/:schoolId/published-reports",
      "/schools/:schoolId/report-publication",
      "/schools/:schoolId/private-report-compositions",
      "/schools/:schoolId/guardian-links",
    ];
    expect(entries.map((entry) => entry.source).sort()).toEqual(
      [...expected].sort(),
    );
    for (const entry of entries) {
      const headers = new Map(
        entry.headers.map(({ key, value }) => [key.toLowerCase(), value]),
      );
      expect(headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(headers.get("pragma")).toBe("no-cache");
      expect(headers.get("x-robots-tag")).toContain("noindex");
      expect(headers.get("referrer-policy")).toBe("no-referrer");
      expect(headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("keeps the private-page header rules scoped to exact school paths", async () => {
    const entries = await nextConfig.headers!();
    for (const entry of entries) {
      expect(entry.source).toMatch(/^\/schools\/:schoolId\//);
      expect(entry.source).not.toContain(":path*");
    }
  });
});

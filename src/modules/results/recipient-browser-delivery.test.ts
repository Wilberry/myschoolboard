import { describe, expect, it, vi } from "vitest";
import { fetchCurrentRecipientRows } from "./recipient-browser-delivery";

describe("recipient browser transport", () => {
  const url = "/api/schools/synthetic/published-reports";

  it("fetches only same-origin, no-store, independently authorized released rows", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ reports: [{ releaseId: "synthetic-release" }] }),
    );
    const controller = new AbortController();
    await expect(
      fetchCurrentRecipientRows<{ releaseId: string }>(
        url,
        controller.signal,
        request,
      ),
    ).resolves.toEqual([{ releaseId: "synthetic-release" }]);
    expect(request).toHaveBeenCalledWith(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
  });

  it("refuses denied or inactive-school access without returning stale rows", async () => {
    for (const status of [400, 401, 404, 409, 500]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("Denied", { status }));
      await expect(
        fetchCurrentRecipientRows(url, undefined, request),
      ).rejects.toThrow("Recipient report unavailable");
    }
  });

  it("refuses non-array and oversized server projections rather than printing", async () => {
    for (const response of [
      {},
      { reports: null },
      { reports: "synthetic-student" },
      { reports: Array.from({ length: 101 }, () => ({})) },
    ]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(response));
      await expect(
        fetchCurrentRecipientRows(url, undefined, request),
      ).rejects.toThrow("Invalid recipient report response");
    }
  });

  it("does not turn an aborted request into a successful recipient report", async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      throw new DOMException("The request was aborted", "AbortError");
    });
    await expect(
      fetchCurrentRecipientRows(url, controller.signal, request),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

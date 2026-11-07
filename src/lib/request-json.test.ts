import { describe, it, expect, vi } from "vitest";
import { readBoundedJson } from "./request-json";
const encode = (s: string) => new TextEncoder().encode(s);
function streamed(
  chunks: Uint8Array[],
  headers: HeadersInit = {},
  cancel = vi.fn(),
) {
  let index = 0;
  return {
    request: new Request("http://localhost/private", {
      method: "POST",
      headers,
      duplex: "half",
      body: new ReadableStream({
        pull(controller) {
          if (index < chunks.length) controller.enqueue(chunks[index++]);
          else controller.close();
        },
        cancel,
      }),
    } as RequestInit),
    cancel,
  };
}
describe("bounded private JSON parsing", () => {
  it("parses split multibyte UTF-8 and preserves exact money strings", async () => {
    const bytes = encode('{"reason":"Ẹkọ","amountMinor":"9007199254740993"}');
    const { request } = streamed([bytes.slice(0, 13), bytes.slice(13)]);
    expect(await readBoundedJson(request)).toEqual({
      reason: "Ẹkọ",
      amountMinor: "9007199254740993",
    });
  });
  it("bounds actual chunked bytes despite missing or forged Content-Length", async () => {
    for (const headers of [{}, { "content-length": "1" }] as HeadersInit[]) {
      const { request, cancel } = streamed(
        [encode('"'), new Uint8Array(65536), encode('"')],
        headers,
      );
      await expect(readBoundedJson(request)).rejects.toThrow(SyntaxError);
      expect(cancel).toHaveBeenCalled();
      expect(request.body?.locked).toBe(false);
    }
  });
  it("rejects invalid/oversize declared lengths without reading payload", async () => {
    for (const value of ["65537", "-1", "abc", "999999999999999999999999999"]) {
      const { request, cancel } = streamed([encode("{}")], {
        "content-length": value,
      });
      await expect(readBoundedJson(request)).rejects.toThrow("Invalid request");
      expect(cancel).toHaveBeenCalled();
    }
  });
  it("accepts exactly the byte limit and rejects one byte more", async () => {
    expect(
      await readBoundedJson(
        new Request("http://localhost/private", {
          method: "POST",
          body: '"' + "x".repeat(65534) + '"',
        }),
      ),
    ).toHaveLength(65534);
    await expect(
      readBoundedJson(
        new Request("http://localhost/private", {
          method: "POST",
          body: '"' + "x".repeat(65535) + '"',
        }),
      ),
    ).rejects.toThrow(SyntaxError);
  });
  it("does not echo malformed bodies, invalid UTF-8 or empty input", async () => {
    for (const bytes of [
      encode("private-pupil-secret"),
      new Uint8Array([0xff]),
      new Uint8Array(),
    ]) {
      const { request } = streamed([bytes]);
      await expect(readBoundedJson(request)).rejects.toThrow("Invalid request");
    }
    await expect(
      readBoundedJson(
        new Request("http://localhost/private", { method: "POST" }),
      ),
    ).rejects.toThrow(SyntaxError);
  });
  it("preserves the rejection and releases lock if stream cancellation fails", async () => {
    const { request } = streamed(
      [new Uint8Array(65537)],
      {},
      vi.fn(() => {
        throw Error("private transport details");
      }),
    );
    await expect(readBoundedJson(request)).rejects.toThrow("Invalid request");
    expect(request.body?.locked).toBe(false);
  });
  it("cancels a stalled stream without accepting a complete-looking prefix", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const request = new Request("http://localhost/private", {
        method: "POST",
        duplex: "half",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(encode("{}"));
          },
          cancel,
        }),
      } as RequestInit);
      const rejected = expect(readBoundedJson(request)).rejects.toThrow(
        "Invalid request",
      );
      await vi.advanceTimersByTimeAsync(10000);
      await rejected;
      expect(cancel).toHaveBeenCalled();
      expect(request.body?.locked).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects oversize input even when underlying cancellation never settles", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const request = new Request("http://localhost/private", {
      method: "POST",
      duplex: "half",
      body: new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(65537));
        },
        cancel,
      }),
    } as RequestInit);
    await expect(readBoundedJson(request)).rejects.toThrow("Invalid request");
    expect(cancel).toHaveBeenCalled();
    expect(request.body?.locked).toBe(false);
  });
});

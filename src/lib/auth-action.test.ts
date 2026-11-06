import { describe, expect, it, vi } from "vitest";
import { authRequestSucceeded } from "./auth-action";

describe("client authentication request handling", () => {
  it("accepts a successful response without an error", async () => {
    expect(await authRequestSucceeded(async () => ({ error: null }))).toBe(
      true,
    );
    expect(await authRequestSucceeded(async () => ({}))).toBe(true);
  });

  it("accepts a fulfilled sign-out request with no response body", async () => {
    expect(await authRequestSucceeded(async () => undefined)).toBe(true);
  });

  it("returns failure without exposing provider error details", async () => {
    const operation = vi.fn(async () => ({
      error: { message: "synthetic provider details", status: 401 },
    }));
    expect(await authRequestSucceeded(operation)).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("recovers from network and transport rejection", async () => {
    const operation = vi.fn(async () => {
      throw new Error("synthetic network failure");
    });
    expect(await authRequestSucceeded(operation)).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

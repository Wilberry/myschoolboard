import { describe, expect, it } from "vitest";
import { mayTransitionPeriod } from "./period-policy";

describe("academic period state machine", () => {
  it.each([
    ["PLANNED", "ACTIVE", true],
    ["ACTIVE", "CLOSED", true],
    ["PLANNED", "CLOSED", false],
    ["ACTIVE", "ACTIVE", false],
    ["CLOSED", "ACTIVE", false],
    ["CLOSED", "CLOSED", false],
  ] as const)("from %s to %s is %s", (previous, next, allowed) => {
    expect(mayTransitionPeriod(previous, next)).toBe(allowed);
  });
});

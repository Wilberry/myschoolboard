import { describe, expect, it } from "vitest";
import { classifyAssignmentDatabaseError } from "./database-error";

describe("teacher assignment database error classification", () => {
  it.each([
    { name: "Prisma unique constraint", error: { code: "P2002" } },
    { name: "Prisma transaction conflict", error: { code: "P2034" } },
    { name: "PostgreSQL serialization", error: { code: "40001" } },
    { name: "PostgreSQL deadlock", error: { sqlState: "40P01" } },
    {
      name: "adapter cause serialization",
      error: { cause: { kind: "postgres", code: "40001" } },
    },
    {
      name: "Prisma raw query adapter deadlock",
      error: {
        code: "P2010",
        meta: {
          driverAdapterError: {
            cause: { kind: "postgres", originalCode: "40P01" },
          },
        },
      },
    },
  ])("maps only known $name to CONFLICT", ({ error }) => {
    expect(classifyAssignmentDatabaseError(error)).toBe("CONFLICT");
  });

  it.each([
    null,
    "40001",
    { code: "P2003" },
    { code: "23503" },
    { code: "P2010", meta: { code: "23503" } },
    { name: "DriverAdapterError", message: "deadlock 40P01" },
    { code: "P2028" },
    { cause: { code: "23514" } },
  ])("keeps unverified or unrelated errors INTERNAL", (error) => {
    expect(classifyAssignmentDatabaseError(error)).toBe("INTERNAL");
  });

  it("does not recurse indefinitely on circular error causes", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(classifyAssignmentDatabaseError(error)).toBe("INTERNAL");
  });
});

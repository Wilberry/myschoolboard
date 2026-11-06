/**
 * Classify only known PostgreSQL serialization/deadlock or Prisma uniqueness
 * conflicts. Prisma's PostgreSQL adapter may wrap SQLSTATE inside a cause or
 * driverAdapterError; no provider messages are parsed or logged.
 *
 * All other database failures remain INTERNAL. This must not turn an
 * arbitrary foreign-key, authorization, or SQL failure into a conflict.
 */
export type AssignmentDatabaseFailure = "CONFLICT" | "INTERNAL";

export function classifyAssignmentDatabaseError(
  error: unknown,
): AssignmentDatabaseFailure {
  const queue: unknown[] = [error];
  const visited = new Set<object>();
  const retryableCodes = new Set(["P2002", "P2034", "40001", "40P01"]);

  for (let index = 0; index < queue.length && index < 24; index += 1) {
    const node = queue[index];
    if (typeof node !== "object" || node === null || visited.has(node)) {
      continue;
    }
    visited.add(node);
    const record = node as Record<string, unknown>;

    for (const field of ["code", "sqlState", "originalCode"] as const) {
      const value = record[field];
      if (typeof value === "string" && retryableCodes.has(value)) {
        return "CONFLICT";
      }
    }

    for (const field of ["cause", "meta", "driverAdapterError"] as const) {
      const child = record[field];
      if (typeof child === "object" && child !== null) {
        queue.push(child);
      }
    }
  }

  return "INTERNAL";
}

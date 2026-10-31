import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertApplicationOrigin,
  assertCleanWorktree,
  assertPortAvailable,
  assertExpectedMigrationCount,
  classifyDatabaseRelations,
} from "./launch-phase1-7-verification.mjs";
import { createServer } from "node:net";

test("requires a clean worktree without modifying it", () => {
  assert.doesNotThrow(() => assertCleanWorktree(""));
  assert.throws(() => assertCleanWorktree(" M file.ts\n"), /clean worktree/);
  assert.throws(
    () => assertCleanWorktree("?? untracked.ts\n"),
    /clean worktree/,
  );
});

test("requires the expected complete 37-migration inventory", () => {
  assert.doesNotThrow(() =>
    assertExpectedMigrationCount(Array.from({ length: 37 })),
  );
  assert.throws(() => assertExpectedMigrationCount([]), /exactly 37/);
  assert.throws(
    () => assertExpectedMigrationCount(Array.from({ length: 36 })),
    /exactly 36/,
  );
});

test("distinguishes an empty database from a schema with Prisma history", () => {
  assert.equal(classifyDatabaseRelations([]), "empty");
  assert.equal(
    classifyDatabaseRelations([
      { schema: "public", name: "_prisma_migrations" },
      { schema: "public", name: "Membership" },
    ]),
    "migrated",
  );
});

test("refuses a non-empty database without Prisma migration history", () => {
  assert.throws(
    () => classifyDatabaseRelations([{ schema: "public", name: "Membership" }]),
    /no Prisma migration history/,
  );
  assert.throws(
    () =>
      classifyDatabaseRelations([
        { schema: "archive", name: "_prisma_migrations" },
      ]),
    /outside the public schema/,
  );
  assert.throws(
    () => classifyDatabaseRelations(null),
    /inspect the test database/,
  );
});

test("requires the local application origin on port 3000", () => {
  assert.doesNotThrow(() =>
    assertApplicationOrigin({ BETTER_AUTH_URL: "http://localhost:3000" }),
  );
  assert.doesNotThrow(() =>
    assertApplicationOrigin({ BETTER_AUTH_URL: "http://127.0.0.1:3000" }),
  );
  assert.throws(
    () => assertApplicationOrigin({ BETTER_AUTH_URL: "http://localhost:3001" }),
    /localhost port 3000/,
  );
});

test("detects an occupied app port before startup", async () => {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await assert.rejects(
      assertPortAvailable("127.0.0.1", address.port),
      /not available/,
    );
  } finally {
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
  await assertPortAvailable("127.0.0.1", 0);
});

test("fresh-run policy refuses existing migrations or unknown state", async () => {
  const { assertFreshFixtureDatabase } =
    await import("./launch-phase1-7-verification.mjs");
  assert.doesNotThrow(() => assertFreshFixtureDatabase("empty"));
  assert.throws(() => assertFreshFixtureDatabase("migrated"), /refusing reuse/);
  assert.throws(() => assertFreshFixtureDatabase(undefined), /refusing reuse/);
});

test("managed commands use the explicitly validated environment", async () => {
  const { ownedSpawnOptions } =
    await import("./launch-phase1-7-verification.mjs");
  const env = { TEST_DATABASE_URL: "synthetic-placeholder", TEST_ONLY: "yes" };
  const options = ownedSpawnOptions(env);
  assert.equal(options.env, env);
  assert.equal(options.shell, false);
  assert.equal(options.detached, process.platform !== "win32");
});

test(
  "managed process-group cleanup terminates its child without targeting unrelated processes",
  { skip: process.platform === "win32" },
  async () => {
    const { spawn } = await import("node:child_process");
    const { cleanupOwnedProcess, ownedGroupExists, signalOwnedGroup } =
      await import("./launch-phase1-7-verification.mjs");
    const unrelated = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { stdio: "ignore" },
    );
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { detached: true, stdio: "ignore" },
    );
    const exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", (error) => resolve({ error }));
    });
    try {
      assert.equal(ownedGroupExists(child), true);
      await cleanupOwnedProcess(child, exited);
      assert.equal(ownedGroupExists(child), false);
      assert.equal(unrelated.exitCode, null);
      assert.doesNotThrow(() =>
        signalOwnedGroup({ pid: undefined }, "SIGTERM"),
      );
    } finally {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      unrelated.kill("SIGKILL");
    }
  },
);

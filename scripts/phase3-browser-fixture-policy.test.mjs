import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPhase3BrowserFixturePolicy } from "./phase3-browser-fixture-policy.mjs";

const environment = {
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL: "postgresql://local@127.0.0.1:5434/myschoolboard_test",
  TEST_DATABASE_URL: "postgresql://local@127.0.0.1:5434/myschoolboard_test",
  BETTER_AUTH_SECRET: "synthetic-only-test-auth-secret-at-least-32-chars",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  DEV_ADMIN_EMAIL: "admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "synthetic-demo-password-one",
  PHASE3_BROWSER_FIXTURE_WRITE: "1",
  PHASE3_BROWSER_RUN_ID: "phase3-nov01-a",
  PHASE3_BROWSER_PASSWORD: "synthetic-browser-private-password-32",
};

test("allows one explicitly opted-in, distinct synthetic-only fixture", () => {
  const fixture = assertPhase3BrowserFixturePolicy(environment);
  assert.equal(fixture.runId, "phase3-nov01-a");
  assert.match(fixture.operatorEmail, /-operator@myschoolboard\.test$/);
  assert.match(fixture.schoolAdminEmail, /-schooladmin@myschoolboard\.test$/);
  assert.equal(fixture.schoolSlugs.length, 2);
  assert.equal(fixture.password, undefined);
});

test("refuses implicit fixture writes and any non-disposable target", () => {
  for (const changes of [
    { PHASE3_BROWSER_FIXTURE_WRITE: undefined },
    { TEST_DATABASE_DISPOSABLE: "0" },
    { NODE_ENV: "production" },
    { ALLOW_DEMO_SEED: "0" },
    { DATABASE_URL: "postgresql://local@127.0.0.1:5433/myschoolboard" },
    { TEST_DATABASE_URL: "postgresql://local@otherhost:5434/myschoolboard_test" },
  ]) {
    assert.throws(() => assertPhase3BrowserFixturePolicy({ ...environment, ...changes }));
  }
});

test("refuses invalid or reused-looking run IDs", () => {
  for (const runId of ["", "short", "UPPERCASE", "../unsafe", "abc_def", "123456789", "a".repeat(27)]) {
    assert.throws(() => assertPhase3BrowserFixturePolicy({
      ...environment, PHASE3_BROWSER_RUN_ID: runId,
    }));
  }
});

test("refuses missing, short or cross-fixture password reuse", () => {
  for (const changes of [
    { PHASE3_BROWSER_PASSWORD: "" },
    { PHASE3_BROWSER_PASSWORD: "short" },
    { PHASE3_BROWSER_PASSWORD: environment.DEV_ADMIN_PASSWORD },
    { BROWSER_FIXTURE_PASSWORD: environment.PHASE3_BROWSER_PASSWORD },
  ]) {
    assert.throws(() => assertPhase3BrowserFixturePolicy({ ...environment, ...changes }));
  }
});

test("never invents school, non-test account or privileged identity from input", () => {
  const fixture = assertPhase3BrowserFixturePolicy(environment);
  assert.deepEqual(fixture.schoolSlugs, [
    "phase3-phase3-nov01-a-a",
    "phase3-phase3-nov01-a-b",
  ]);
  for (const key of Object.values(fixture)) {
    if (typeof key === "string" && key.includes("@")) {
      assert.ok(key.endsWith("@myschoolboard.test"));
    }
  }
});

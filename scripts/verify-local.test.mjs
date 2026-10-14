import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertLocalVerificationTarget,
  workflowCommands,
} from "./verify-local.mjs";

const approvedEnvironment = {
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL:
    "postgresql://myschoolboard:local_test_password@localhost:5434/myschoolboard_test?schema=public",
  TEST_DATABASE_URL:
    "postgresql://myschoolboard:local_test_password@localhost:5434/myschoolboard_test?schema=public",
  BETTER_AUTH_SECRET: "synthetic-ci-test-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  DEV_ADMIN_EMAIL: "admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "synthetic-ci-password-42",
};

test("accepts only explicitly opted-in disposable test target", () => {
  assert.doesNotThrow(() => assertLocalVerificationTarget(approvedEnvironment));
});

for (const [name, changes] of [
  ["production environment", { NODE_ENV: "production" }],
  ["missing disposable marker", { TEST_DATABASE_DISPOSABLE: "0" }],
  ["seed disabled", { ALLOW_DEMO_SEED: "0" }],
  [
    "mismatched URL",
    {
      DATABASE_URL:
        "postgresql://myschoolboard:password@localhost:5433/myschoolboard",
    },
  ],
  [
    "shared host",
    {
      DATABASE_URL:
        "postgresql://myschoolboard:password@shared.example:5434/myschoolboard_test",
      TEST_DATABASE_URL:
        "postgresql://myschoolboard:password@shared.example:5434/myschoolboard_test",
    },
  ],
  [
    "wrong database",
    {
      DATABASE_URL:
        "postgresql://myschoolboard:password@localhost:5434/production",
      TEST_DATABASE_URL:
        "postgresql://myschoolboard:password@localhost:5434/production",
    },
  ],
  ["short Better Auth secret", { BETTER_AUTH_SECRET: "short" }],
  [
    "remote Better Auth origin",
    { BETTER_AUTH_URL: "https://auth.example.com" },
  ],
  ["non-synthetic seed email", { DEV_ADMIN_EMAIL: "owner@example.com" }],
]) {
  test(`refuses ${name}`, () => {
    assert.throws(() =>
      assertLocalVerificationTarget({ ...approvedEnvironment, ...changes }),
    );
  });
}

test("keeps the configured GitHub CI command order and audit threshold", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const actualCommands = [...workflow.matchAll(/^\s+- run: npm (.+)$/gm)].map(
    ([, argumentsText]) => argumentsText.trim().split(/\s+/),
  );
  assert.deepEqual(workflowCommands, actualCommands);
  assert.deepEqual(workflowCommands.at(-1), ["audit", "--audit-level=high"]);
});

test("checks applied migration hashes before local deployment without editing CI/audit gates", () => {
  const runner = readFileSync(
    new URL("./verify-local.mjs", import.meta.url),
    "utf8",
  );
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.match(runner, /args\[1\] === "db:generate"/);
  assert.match(runner, /\["run", "verify:local:checksums"\]/);
  assert.equal(
    pkg.scripts["verify:local:checksums"],
    "node scripts/migration-checksum-preflight.mjs",
  );
  assert.match(
    pkg.scripts["test"],
    /migration-checksum-preflight\.test\.mjs/,
  );
  assert.match(
    pkg.scripts["verify:local:guards"],
    /migration-checksum-preflight\.test\.mjs/,
  );
  assert.deepEqual(workflowCommands.at(-1), ["audit", "--audit-level=high"]);
});

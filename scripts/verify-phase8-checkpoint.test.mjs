import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertDisposableCompose,
  assertLocalDockerEndpoint,
  assertPhase8Checkout,
  assertPhase8Environment,
} from "./verify-phase8-checkpoint.mjs";

const cleanCheckout = Object.freeze({
  topLevel: "/home/wilberry/Desktop/project/myschoolboard-phase8",
  scriptRoot: "/home/wilberry/Desktop/project/myschoolboard-phase8",
  branch: "verify/phase8-local",
  status: "",
  head: "a".repeat(40),
  trackingHead: "a".repeat(40),
});

test("requires clean Phase 8 worktree and matching remote HEAD", () => {
  assert.doesNotThrow(() => assertPhase8Checkout(cleanCheckout));
  for (const changed of [
    { topLevel: "/home/wilberry/Desktop/project/myschoolboard" },
    { scriptRoot: "/home/wilberry/Desktop/project/myschoolboard" },
    { branch: "checkpoint/phase1-tenant-safe-foundation" },
    { branch: "main" },
    { status: " M src/components/example.tsx" },
    { status: "?? sensitive-untracked-file.txt" },
    { head: "b".repeat(40) },
    { trackingHead: "b".repeat(40) },
    { trackingHead: "" },
  ]) {
    assert.throws(
      () => assertPhase8Checkout({ ...cleanCheckout, ...changed }),
      /Refusing/,
    );
  }
});

const validCompose = Object.freeze({
  tmpfs: ["/var/lib/postgresql/data:rw,noexec,nosuid,size=256m"],
  ports: [{ host_ip: "127.0.0.1", published: "5434", target: 5432 }],
});

test("requires tmpfs-backed loopback PostgreSQL", () => {
  assert.doesNotThrow(() => assertDisposableCompose(validCompose));
  for (const changed of [
    { tmpfs: [] },
    { tmpfs: ["/home/postgresql-data"] },
    { ports: [{ host_ip: "0.0.0.0", published: "5434", target: 5432 }] },
    { ports: [{ host_ip: "127.0.0.1", published: "5433", target: 5432 }] },
    { ports: [{ host_ip: "127.0.0.1", published: "5434", target: 5433 }] },
    {
      ports: [
        { host_ip: "127.0.0.1", published: "5434", target: 5432 },
        { host_ip: "0.0.0.0", published: "5435", target: 5432 },
      ],
    },
  ]) {
    assert.throws(
      () => assertDisposableCompose({ ...validCompose, ...changed }),
      /Refusing/,
    );
  }
});

const safeEnvironment = Object.freeze({
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL:
    "postgresql://myschoolboard:synthetic@localhost:5434/myschoolboard_test?schema=public",
  TEST_DATABASE_URL:
    "postgresql://myschoolboard:synthetic@localhost:5434/myschoolboard_test?schema=public",
  BETTER_AUTH_SECRET: "synthetic-long-test-only-secret-for-local-tests",
  BETTER_AUTH_URL: "http://localhost:3000",
  DEV_ADMIN_EMAIL: "admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "synthetic-test-only-password",
  PHASE8_REPORT_RELEASE_ENABLED: "false",
  PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "false",
});

test("refuses shared targets or enabled disclosure flags", () => {
  assert.doesNotThrow(() => assertPhase8Environment(safeEnvironment));
  for (const changed of [
    { NODE_ENV: "production" },
    { TEST_DATABASE_DISPOSABLE: "0" },
    { DATABASE_URL: "postgresql://shared-host/prod" },
    { PHASE8_REPORT_RELEASE_ENABLED: "true" },
    { PHASE8_REPORT_RELEASE_ENABLED: undefined },
    { PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "true" },
    { PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: undefined },
  ]) {
    assert.throws(() =>
      assertPhase8Environment({ ...safeEnvironment, ...changed }),
    );
  }
});

test("refuses remote or unknown Docker daemon before Phase 8 migrations", () => {
  assert.doesNotThrow(() =>
    assertLocalDockerEndpoint("unix:///var/run/docker.sock"),
  );
  assert.doesNotThrow(() =>
    assertLocalDockerEndpoint(
      "unix:///var/run/docker.sock",
      "unix:///home/test/.docker/desktop/docker.sock",
    ),
  );
  for (const endpoint of [
    "",
    "unix:///",
    "ssh://remote",
    "tcp://127.0.0.1:2375",
    "tcp://remote:2376",
    "https://docker.example",
    "unix:///var/run/docker.sock" + String.fromCharCode(10),
  ]) {
    assert.throws(() => assertLocalDockerEndpoint(endpoint), /Refusing/);
  }
  for (const override of [
    "ssh://remote",
    "tcp://localhost:2375",
    "http://remote",
    "unix:///",
    "unix:///var/run/docker.sock" + String.fromCharCode(13),
  ]) {
    assert.throws(
      () => assertLocalDockerEndpoint("unix:///var/run/docker.sock", override),
      /Refusing/,
    );
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertBrowserFixtureEnvironment,
  assertLocalDockerFixtureTarget,
} from "./browser-fixture-safety.mjs";

const databaseURL = [
  "postgresql://myschoolboard:local_test_password@localhost:5434/",
  "myschoolboard_test?schema=public",
].join("");

const environment = {
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL: databaseURL,
  TEST_DATABASE_URL: databaseURL,
  BETTER_AUTH_SECRET: "local-browser-test-secret-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  DEV_ADMIN_EMAIL: "admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "different-demo-password-42",
  BROWSER_FIXTURE_WRITE: "1",
  BROWSER_FIXTURE_RUN_ID: "browser-sec-2026",
  BROWSER_FIXTURE_PASSWORD: "synthetic-browser-only-password-42",
};

const worktree = "/home/test/myschoolboard-format";
const container = {
  Config: {
    Image: "postgres:17-alpine",
    Labels: {
      "com.docker.compose.service": "postgres-test",
      "com.docker.compose.project.working_dir": worktree,
    },
  },
  HostConfig: {
    Tmpfs: { "/var/lib/postgresql/data": "" },
    Binds: null,
    PortBindings: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "5434" }],
    },
  },
  Mounts: [{ Type: "tmpfs", Destination: "/var/lib/postgresql/data" }],
  State: { Running: true, Health: { Status: "healthy" } },
};

const inspect = (value = container, endpoint = "unix:///var/run/docker.sock") =>
  assertLocalDockerFixtureTarget(endpoint, value, worktree);

test("accepts explicit synthetic fixtures on disposable test target", () => {
  assert.doesNotThrow(() => assertBrowserFixtureEnvironment(environment));
  assert.doesNotThrow(() => inspect());
});

test("rejects absent opt-in, reused passwords and invalid run labels", () => {
  for (const changes of [
    { BROWSER_FIXTURE_WRITE: "0" },
    { BROWSER_FIXTURE_RUN_ID: "../escape" },
    { BROWSER_FIXTURE_RUN_ID: "" },
    { BROWSER_FIXTURE_PASSWORD: "short" },
    { BROWSER_FIXTURE_PASSWORD: environment.DEV_ADMIN_PASSWORD },
  ]) {
    assert.throws(() =>
      assertBrowserFixtureEnvironment({ ...environment, ...changes }),
    );
  }
});

test("rejects development, remote and incorrect database targets", () => {
  const sharedURL = "postgresql://db.example.test:5434/myschoolboard_test";
  const developmentURL =
    "postgresql://myschoolboard:pw@localhost:5433/myschoolboard";
  for (const changes of [
    { NODE_ENV: "development" },
    { TEST_DATABASE_DISPOSABLE: "0" },
    { TEST_DATABASE_URL: sharedURL },
    { DATABASE_URL: developmentURL },
  ]) {
    assert.throws(() =>
      assertBrowserFixtureEnvironment({ ...environment, ...changes }),
    );
  }
});

test("rejects remote Docker daemons", () => {
  for (const endpoint of ["tcp://localhost:2375", "ssh://server", ""]) {
    assert.throws(() => inspect(container, endpoint), /local Unix socket/);
  }
});

test("rejects wrong service, image and worktree", () => {
  for (const field of ["image", "service", "workingDirectory"]) {
    const value = structuredClone(container);
    if (field === "image") value.Config.Image = "postgres:16";
    if (field === "service") {
      value.Config.Labels["com.docker.compose.service"] = "postgres";
    }
    if (field === "workingDirectory") {
      value.Config.Labels["com.docker.compose.project.working_dir"] =
        "/home/test/other";
    }
    assert.throws(() => inspect(value), /not this worktree/);
  }
});

test("rejects public or mismatched port bindings", () => {
  for (const binding of [
    { HostIp: "0.0.0.0", HostPort: "5434" },
    { HostIp: "127.0.0.1", HostPort: "5433" },
  ]) {
    const value = structuredClone(container);
    value.HostConfig.PortBindings["5432/tcp"] = [binding];
    assert.throws(() => inspect(value), /loopback port/);
  }
});

test("rejects non-tmpfs data and host bind mounts", () => {
  const noTmpfs = structuredClone(container);
  noTmpfs.HostConfig.Tmpfs = {};
  assert.throws(() => inspect(noTmpfs), /tmpfs/);
  const bindMounted = structuredClone(container);
  bindMounted.HostConfig.Binds = ["/home/me:/var/lib/postgresql/data"];
  assert.throws(() => inspect(bindMounted), /tmpfs/);
  const volumeMounted = structuredClone(container);
  volumeMounted.Mounts[0].Type = "volume";
  assert.throws(() => inspect(volumeMounted), /tmpfs/);
});

test("permits Compose tmpfs represented only in HostConfig", () => {
  const inspected = structuredClone(container);
  inspected.Mounts = [];
  assert.doesNotThrow(() => inspect(inspected));
});

test("rejects stopped or unhealthy containers", () => {
  const stopped = structuredClone(container);
  stopped.State.Running = false;
  assert.throws(() => inspect(stopped), /running and healthy/);
  const unhealthy = structuredClone(container);
  unhealthy.State.Health.Status = "starting";
  assert.throws(() => inspect(unhealthy), /running and healthy/);
});

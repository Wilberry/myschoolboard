import { resolve } from "node:path";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const runIdPattern = /^[a-z][a-z0-9-]{5,25}$/;

export function assertBrowserFixtureEnvironment(environment = process.env) {
  assertLocalVerificationTarget(environment);
  if (environment.BROWSER_FIXTURE_WRITE !== "1") {
    throw new Error("Set BROWSER_FIXTURE_WRITE=1 for synthetic fixtures");
  }
  if (!runIdPattern.test(environment.BROWSER_FIXTURE_RUN_ID ?? "")) {
    throw new Error("Use a unique lowercase BROWSER_FIXTURE_RUN_ID");
  }
  if (
    typeof environment.BROWSER_FIXTURE_PASSWORD !== "string" ||
    environment.BROWSER_FIXTURE_PASSWORD.length < 16
  ) {
    throw new Error("Synthetic browser password must be at least 16 chars");
  }
  if (
    environment.BROWSER_FIXTURE_PASSWORD === environment.DEV_ADMIN_PASSWORD
  ) {
    throw new Error("Browser fixture password must differ from demo password");
  }
}

export function assertLocalDockerFixtureTarget(
  endpoint,
  container,
  repositoryRoot,
) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("unix://")) {
    throw new Error("Docker daemon must use a local Unix socket");
  }
  if (!container || typeof container !== "object") {
    throw new Error("Missing Docker test container inspection");
  }
  if (
    container.Config?.Image !== "postgres:17-alpine" ||
    container.Config?.Labels?.["com.docker.compose.service"] !==
      "postgres-test" ||
    resolve(
      container.Config?.Labels?.["com.docker.compose.project.working_dir"] ??
        "/invalid",
    ) !== resolve(repositoryRoot)
  ) {
    throw new Error("Docker container is not this worktree's test service");
  }

  const bindings = container.HostConfig?.PortBindings?.["5432/tcp"];
  if (
    !Array.isArray(bindings) ||
    bindings.length !== 1 ||
    bindings[0]?.HostIp !== "127.0.0.1" ||
    bindings[0]?.HostPort !== "5434"
  ) {
    throw new Error("Test DB must bind only to loopback port 5434");
  }

  const path = "/var/lib/postgresql/data";
  const tmpfs = container.HostConfig?.Tmpfs;
  const mountedData = container.Mounts?.find(
    (mount) => mount.Destination === path,
  );
  if (
    !tmpfs ||
    !Object.hasOwn(tmpfs, path) ||
    (container.HostConfig?.Binds ?? []).length > 0 ||
    (mountedData && mountedData.Type !== "tmpfs")
  ) {
    throw new Error("Test DB data must be tmpfs, without host binds");
  }
  if (
    container.State?.Running !== true ||
    container.State?.Health?.Status !== "healthy"
  ) {
    throw new Error("Test DB must be running and healthy");
  }
}

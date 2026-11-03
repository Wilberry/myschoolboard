import { resolve } from "node:path";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const runIdPattern = /^[a-z][a-z0-9-]{5,25}$/;

export function isLoopbackBrowserOrigin(value) {
  let origin;
  try {
    origin = new URL(value);
  } catch {
    return false;
  }
  return (
    origin.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname) &&
    origin.port !== "" &&
    Number(origin.port) >= 3000 &&
    Number(origin.port) <= 65535 &&
    origin.username === "" &&
    origin.password === "" &&
    origin.pathname === "/" &&
    origin.search === "" &&
    origin.hash === ""
  );
}

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
  if (environment.BROWSER_FIXTURE_PASSWORD === environment.DEV_ADMIN_PASSWORD) {
    throw new Error("Browser fixture password must differ from demo password");
  }
}

export function assertLocalDockerFixtureTarget(
  endpoint,
  container,
  repositoryRoot,
  namespaceOwner = null,
  namespaceNetwork = null,
) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("unix://")) {
    throw new Error("Docker daemon must use a local Unix socket");
  }
  if (!container || typeof container !== "object") {
    throw new Error("Missing Docker test container inspection");
  }
  const labels = container.Config?.Labels ?? {};
  const isComposeService =
    labels["com.docker.compose.service"] === "postgres-test" &&
    resolve(labels["com.docker.compose.project.working_dir"] ?? "/invalid") ===
      resolve(repositoryRoot);
  const ownerName = labels["myschoolboard.network-namespace.owner"];
  const isIsolatedNamespace =
    namespaceOwner !== null &&
    namespaceNetwork !== null &&
    labels["myschoolboard.worktree"] === resolve(repositoryRoot) &&
    labels["myschoolboard.purpose"] === "phase8-local-acceptance" &&
    ownerName === namespaceOwner.Name?.replace(/^\//, "") &&
    container.HostConfig?.NetworkMode === `container:${namespaceOwner.Id}` &&
    namespaceOwner.Config?.Image === "node:22.16.0-bookworm-slim" &&
    namespaceOwner.Config?.Labels?.["myschoolboard.worktree"] ===
      resolve(repositoryRoot) &&
    namespaceOwner.Config?.Labels?.["myschoolboard.purpose"] ===
      "phase8-local-acceptance" &&
    namespaceOwner.HostConfig?.NetworkMode === namespaceNetwork.Name &&
    namespaceNetwork.Driver === "bridge" &&
    namespaceNetwork.Internal === true &&
    namespaceNetwork.Labels?.["myschoolboard.worktree"] ===
      resolve(repositoryRoot) &&
    namespaceNetwork.Labels?.["myschoolboard.purpose"] ===
      "phase8-local-acceptance" &&
    namespaceOwner.State?.Running === true &&
    namespaceOwner.HostConfig?.NetworkMode !== "host" &&
    namespaceOwner.HostConfig?.Privileged !== true &&
    namespaceOwner.HostConfig?.PublishAllPorts !== true &&
    Object.values(namespaceOwner.NetworkSettings?.Ports ?? {})
      .flat()
      .filter(Boolean).length === 0 &&
    Object.keys(namespaceOwner.HostConfig?.PortBindings ?? {}).length === 0;
  if (
    container.Config?.Image !== "postgres:17-alpine" ||
    (!isComposeService && !isIsolatedNamespace)
  ) {
    throw new Error("Docker container is not this worktree's test service");
  }
  const containerEnvironment = new Set(container.Config?.Env ?? []);
  if (
    !containerEnvironment.has("POSTGRES_DB=myschoolboard_test") ||
    !containerEnvironment.has("POSTGRES_USER=myschoolboard")
  ) {
    throw new Error(
      "Docker service is not configured for the disposable test database",
    );
  }

  if (isIsolatedNamespace) {
    const portBindings = container.HostConfig?.PortBindings ?? {};
    const publishedPorts = Object.values(container.NetworkSettings?.Ports ?? {})
      .flat()
      .filter(Boolean);
    if (
      Object.keys(portBindings).length !== 0 ||
      container.HostConfig?.PublishAllPorts === true ||
      publishedPorts.length !== 0 ||
      container.Config?.Cmd?.join(" ").includes(
        "listen_addresses=127.0.0.1",
      ) !== true ||
      container.Config?.Cmd?.join(" ").includes("port=5434") !== true
    ) {
      throw new Error(
        "Namespaced test DB must bind only to its own loopback port 5434",
      );
    }
  } else {
    const bindings = container.HostConfig?.PortBindings?.["5432/tcp"];
    if (
      !Array.isArray(bindings) ||
      bindings.length !== 1 ||
      bindings[0]?.HostIp !== "127.0.0.1" ||
      bindings[0]?.HostPort !== "5434"
    ) {
      throw new Error("Test DB must bind only to loopback port 5434");
    }
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

import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const branchName = "verify/phase8-local";

/**
 * This entry point is intentionally tied to the separate Phase 8 worktree.
 * Resolve paths from this script, never the shell's possibly wrong cwd.
 * No checkout, branch switch, destructive Git mutation, Docker start or DB reset.
 */
export function assertPhase8Checkout(info) {
  if (
    basename(resolve(info.topLevel)) !== "myschoolboard-phase8" ||
    resolve(info.topLevel) !== resolve(info.scriptRoot)
  ) {
    throw new Error(
      "Refusing: this is not the separate myschoolboard-phase8 worktree",
    );
  }
  if (info.branch !== branchName) {
    throw new Error(`Refusing: expected ${branchName}, got ${info.branch}`);
  }
  if (info.status.trim()) {
    throw new Error(
      "Refusing: Phase 8 worktree has uncommitted or untracked files",
    );
  }
  if (!/^[a-f0-9]{40}$/.test(info.head) || info.head !== info.trackingHead) {
    throw new Error(
      "Refusing: Phase 8 HEAD does not match origin/verify/phase8-local",
    );
  }
}

export function assertDisposableCompose(service) {
  const mounts = service?.tmpfs ?? [];
  const ports = service?.ports ?? [];
  const dataInMemory = mounts.some((mount) =>
    String(typeof mount === "string" ? mount : mount.target).startsWith(
      "/var/lib/postgresql/data",
    ),
  );
  if (
    !dataInMemory ||
    ports.length !== 1 ||
    ports[0].host_ip !== "127.0.0.1" ||
    String(ports[0].published) !== "5434" ||
    String(ports[0].target) !== "5432"
  ) {
    throw new Error(
      "Refusing: postgres-test must use tmpfs and only 127.0.0.1:5434->5432",
    );
  }
}

/**
 * A remote Docker context can publish a fake local-looking port on another
 * machine. Refuse that target before any database-mutating verification step.
 */
export function assertLocalDockerEndpoint(contextHost, configuredHost) {
  const safeSocket = (value) =>
    typeof value === "string" &&
    value.startsWith("unix:///") &&
    value.length > "unix:///".length &&
    !value.includes(String.fromCharCode(10)) &&
    !value.includes(String.fromCharCode(13));
  if (!safeSocket(contextHost)) {
    throw new Error("Refusing: Docker context is not a local Unix socket");
  }
  if (configuredHost && !safeSocket(configuredHost)) {
    throw new Error("Refusing: DOCKER_HOST overrides local Docker context");
  }
}

function execute(executable, args, extra = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    ...extra,
  });
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) {
    throw new Error(
      `Verification preflight failed: ${executable} ${args.join(" ")}`,
    );
  }
  return (result.stdout ?? "").trim();
}

export function assertPhase8Environment(environment) {
  assertLocalVerificationTarget(environment);
  if (
    environment.PHASE8_REPORT_RELEASE_ENABLED !== "false" ||
    environment.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED !== "false"
  ) {
    throw new Error("Both Phase 8 disclosure flags must explicitly be false");
  }
}

export function preflightPhase8Checkpoint(environment = process.env) {
  // Fail before ANY external command when the target is not disposable.
  assertPhase8Environment(environment);
  const topLevel = execute("git", ["rev-parse", "--show-toplevel"]);
  const branch = execute("git", ["branch", "--show-current"]);
  const status = execute("git", ["status", "--porcelain=v1"]);
  const head = execute("git", ["rev-parse", "HEAD"]);
  const trackingHead = execute("git", [
    "rev-parse",
    "refs/remotes/origin/verify/phase8-local",
  ]);
  assertPhase8Checkout({
    topLevel,
    scriptRoot: root,
    branch,
    status,
    head,
    trackingHead,
  });

  const contextHost = execute("docker", [
    "context",
    "inspect",
    "--format",
    "{{.Endpoints.docker.Host}}",
  ]);
  assertLocalDockerEndpoint(contextHost, environment.DOCKER_HOST);

  const compose = JSON.parse(
    execute("docker", [
      "compose",
      "--profile",
      "test",
      "config",
      "--format",
      "json",
    ]),
  );
  assertDisposableCompose(compose.services?.["postgres-test"]);
  execute("docker", [
    "compose",
    "--profile",
    "test",
    "exec",
    "-T",
    "postgres-test",
    "pg_isready",
    "-U",
    "myschoolboard",
    "-d",
    "myschoolboard_test",
  ]);
  console.info(
    [
      `Phase 8 preflight passed: ${head.slice(0, 12)}`,
      "clean separate worktree",
      "disposable PostgreSQL healthy",
    ].join("; "),
  );
  return head;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [mode] = process.argv.slice(2);
    if (!["--preflight", "--run"].includes(mode) || process.argv.length !== 3) {
      throw new Error(
        "Use --preflight (read-only) or --run (full test-only verification)",
      );
    }
    preflightPhase8Checkpoint();
    if (mode === "--run") {
      // The established runner owns the checksum preflight and all unchanged
      // CI commands, including the mandatory high-severity dependency audit.
      execute(process.execPath, ["scripts/verify-local.mjs"], {
        encoding: undefined,
        stdio: "inherit",
      });
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Phase 8 preflight failed",
    );
    process.exitCode = 1;
  }
}

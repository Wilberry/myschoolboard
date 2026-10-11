import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Reproduces the existing GitHub CI commands against a separately provisioned,
 * disposable, loopback-only test database. This command never provisions a DB.
 */
export function assertLocalVerificationTarget(environment) {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Local CI requires NODE_ENV=test");
  }
  if (environment.TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("Local CI requires TEST_DATABASE_DISPOSABLE=1");
  }
  if (environment.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Local CI requires ALLOW_DEMO_SEED=1");
  }
  if (
    !environment.DATABASE_URL ||
    !environment.TEST_DATABASE_URL ||
    environment.DATABASE_URL !== environment.TEST_DATABASE_URL
  ) {
    throw new Error("DATABASE_URL must exactly equal TEST_DATABASE_URL");
  }

  let target;
  try {
    target = new URL(environment.TEST_DATABASE_URL);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }
  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !allowedHosts.has(target.hostname) ||
    target.port !== "5434" ||
    decodeURIComponent(target.pathname.slice(1)) !== "myschoolboard_test"
  ) {
    throw new Error(
      "Local CI may only access localhost:5434/myschoolboard_test",
    );
  }
  if (
    !environment.BETTER_AUTH_SECRET ||
    environment.BETTER_AUTH_SECRET.length < 32
  ) {
    throw new Error(
      "Local CI requires a test-only Better Auth secret of at least 32 characters",
    );
  }
  let authOrigin;
  try {
    authOrigin = new URL(environment.BETTER_AUTH_URL);
  } catch {
    throw new Error("BETTER_AUTH_URL must be a local test URL");
  }
  if (
    authOrigin.protocol !== "http:" ||
    !allowedHosts.has(authOrigin.hostname)
  ) {
    throw new Error("BETTER_AUTH_URL must use a loopback-only HTTP origin");
  }
  if (
    !environment.DEV_ADMIN_EMAIL?.endsWith(".test") ||
    !environment.DEV_ADMIN_PASSWORD ||
    environment.DEV_ADMIN_PASSWORD.length < 12
  ) {
    throw new Error("Local CI seed requires synthetic .test credentials");
  }
}

export const workflowCommands = Object.freeze([
  ["ci"],
  ["run", "db:generate"],
  ["run", "db:deploy"],
  ["run", "db:seed"],
  ["run", "format:check"],
  ["run", "lint"],
  ["run", "typecheck"],
  ["test"],
  ["run", "build"],
  ["audit", "--audit-level=high"],
]);

export function runLocalVerification(environment = process.env) {
  assertLocalVerificationTarget(environment);
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  for (const args of workflowCommands) {
    console.info(`Running: npm ${args.join(" ")}`);
    const result = spawnSync(executable, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: environment,
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.signal) {
      throw new Error(`Local CI interrupted during npm ${args.join(" ")}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `Local CI failed at npm ${args.join(" ")} (exit ${result.status})`,
      );
    }
  }
  console.info("Local CI: all workflow steps passed");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--help") {
      console.info(
        "Usage: npm run verify:local (runs actual CI steps) or npm run verify:local:preflight (checks safe test DB target only)",
      );
    } else if (args.length === 1 && args[0] === "--preflight") {
      assertLocalVerificationTarget(process.env);
      console.info("Local CI preflight passed; no commands were run");
    } else if (args.length === 0) {
      runLocalVerification();
    } else {
      throw new Error("Unrecognized argument; use --help or --preflight");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local CI failed");
    process.exitCode = 1;
  }
}

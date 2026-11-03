import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";
import {
  assertBrowserFixtureEnvironment,
  assertLocalDockerFixtureTarget,
} from "./browser-fixture-safety.mjs";
import {
  readLocalMigrationChecksums,
  runMigrationChecksumVerification,
} from "./verify-migration-checksums.mjs";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const expectedMigrationCount = 38;
const port = 3000;
const origin = "http://127.0.0.1:3000";

export function assertCleanWorktree(status) {
  if (typeof status !== "string") {
    throw new Error("Could not inspect the Git worktree");
  }
  if (status.length > 0) {
    throw new Error(
      "Verification requires a clean worktree; no files were changed or discarded",
    );
  }
}

export function assertExpectedMigrationCount(migrations) {
  if (
    !Array.isArray(migrations) ||
    migrations.length !== expectedMigrationCount
  ) {
    throw new Error(
      `Expected exactly ${expectedMigrationCount} local migrations`,
    );
  }
}

export function classifyDatabaseRelations(relations) {
  if (
    !Array.isArray(relations) ||
    relations.some(
      (relation) =>
        !relation ||
        typeof relation.schema !== "string" ||
        typeof relation.name !== "string",
    )
  ) {
    throw new Error("Could not inspect the test database schema");
  }
  if (relations.length === 0) return "empty";
  if (relations.some((relation) => relation.schema !== "public")) {
    throw new Error(
      "Test database contains relations outside the public schema; refusing changes",
    );
  }
  if (!relations.some((relation) => relation.name === "_prisma_migrations")) {
    throw new Error(
      "Test database is non-empty but has no Prisma migration history; refusing changes",
    );
  }
  return "migrated";
}

/** The initial browser session must never reuse a database with existing records. */
export function assertFreshFixtureDatabase(databaseState) {
  if (databaseState !== "empty") {
    throw new Error(
      "Browser verification requires an empty disposable database; refusing reuse",
    );
  }
}

function command(
  commandName,
  args,
  { capture = false, environment = process.env } = {},
) {
  const result = spawnSync(commandName, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    timeout: 600_000,
    maxBuffer: 1_048_576,
    shell: false,
    env: environment,
  });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(
      `Verification command failed: ${commandName} ${args.join(" ")}`,
    );
  }
  return capture ? result.stdout.trim() : "";
}

function checkCleanGitWorktree() {
  const status = command(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { capture: true },
  );
  assertCleanWorktree(status);
}

function verifyDockerTarget() {
  const context = command("docker", ["context", "show"], { capture: true });
  if (!/^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(context)) {
    throw new Error("Could not verify a local Docker context");
  }
  const endpoint = command(
    "docker",
    ["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"],
    { capture: true },
  );
  const ids = command(
    "docker",
    ["compose", "--profile", "test", "ps", "-q", "postgres-test"],
    { capture: true },
  )
    .split("\n")
    .filter(Boolean);
  if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/i.test(ids[0])) {
    throw new Error(
      "Expected exactly one running Compose postgres-test container",
    );
  }
  const inspected = JSON.parse(
    command("docker", ["inspect", ids[0]], { capture: true }),
  );
  if (!Array.isArray(inspected) || inspected.length !== 1) {
    throw new Error("Could not inspect the Compose postgres-test container");
  }
  assertLocalDockerFixtureTarget(endpoint, inspected[0], projectRoot);
}

async function readDatabaseRelations(environment) {
  const { Client } = pg;
  const client = new Client({
    connectionString: environment.TEST_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    inTransaction = true;
    const result = await client.query(
      `SELECT n.nspname AS schema_name, c.relname AS name
       FROM pg_catalog.pg_class AS c
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_toast%'
         AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
       ORDER BY n.nspname, c.relname`,
    );
    await client.query("COMMIT");
    inTransaction = false;
    return result.rows.map((row) => ({
      schema: row.schema_name,
      name: row.name,
    }));
  } catch {
    throw new Error(
      "Could not safely inspect the disposable test database schema",
    );
  } finally {
    if (inTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    await client.end().catch(() => {});
  }
}

export async function assertPortAvailable(
  host = "127.0.0.1",
  portNumber = port,
) {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", () =>
      rejectListen(new Error(`Port ${portNumber} is not available on ${host}`)),
    );
    server.listen({ host, port: portNumber, exclusive: true }, resolveListen);
  });
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

export function assertApplicationOrigin(environment) {
  if (
    environment.BETTER_AUTH_URL !== "http://localhost:3000" &&
    environment.BETTER_AUTH_URL !== origin
  ) {
    throw new Error(
      "BETTER_AUTH_URL must be localhost port 3000 for local browser verification",
    );
  }
}

function observeApplication(child) {
  return new Promise((resolveExit) => {
    child.once("error", (error) => resolveExit({ error }));
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
}

/** Every managed child runs in its own group on POSIX. Never target another PID. */
export function signalOwnedGroup(child, signal) {
  if (!Number.isSafeInteger(child?.pid) || child.pid <= 0) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

export function ownedGroupExists(child) {
  if (!Number.isSafeInteger(child?.pid) || child.pid <= 0) return false;
  if (process.platform === "win32")
    return child.exitCode === null && child.signalCode === null;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

export async function cleanupOwnedProcess(child, childExited) {
  if (!child?.pid) {
    await childExited;
    return;
  }
  signalOwnedGroup(child, "SIGTERM");
  const deadline = Date.now() + 3000;
  while (ownedGroupExists(child) && Date.now() < deadline) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  if (ownedGroupExists(child)) signalOwnedGroup(child, "SIGKILL");
  await Promise.race([
    childExited,
    new Promise((resolveDelay) => setTimeout(resolveDelay, 1500)),
  ]);
}

/** Asynchronous commands permit SIGINT/SIGTERM cleanup during fixture writes. */
export function ownedSpawnOptions(environment) {
  return {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
    shell: false,
    detached: process.platform !== "win32",
  };
}

async function runOwnedNpm(args, environment, setActive, checkInterrupted) {
  checkInterrupted();
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    ...ownedSpawnOptions(environment),
  });
  const exited = observeApplication(child);
  setActive({ child, exited });
  try {
    const result = await exited;
    checkInterrupted();
    if (result.error || result.code !== 0 || result.signal !== null) {
      throw new Error(`Verification command failed: npm ${args.join(" ")}`);
    }
  } finally {
    await cleanupOwnedProcess(child, exited);
    setActive(null);
  }
}

async function waitForApplication(childExited) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const exited = await Promise.race([
      childExited,
      new Promise((resolveDelay) => setTimeout(() => resolveDelay(null), 300)),
    ]);
    if (exited) {
      throw new Error(
        `Local application exited before readiness (${exited.error ? "spawn error" : (exited.signal ?? exited.code)})`,
      );
    }
    try {
      const response = await fetch(`${origin}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch {
      // The server may not yet be listening; retry until the bounded deadline.
    }
  }
  throw new Error("Local application did not become ready on port 3000");
}

function startApplication(environment) {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(
    executable,
    ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"],
    ownedSpawnOptions(environment),
  );
}

async function waitForApplicationExit(childExited) {
  const result = await childExited;
  if (result.error) throw new Error("Local application process failed");
  if (result.signal !== null) {
    throw new Error(`Local application stopped after signal ${result.signal}`);
  }
  if (result.code !== 0) {
    throw new Error(`Local application exited with status ${result.code}`);
  }
}

function printUsage() {
  console.info(
    "Usage: npm run verify:browser:session (requires a clean worktree and an already-running verified postgres-test service)",
  );
}

export async function launchVerification(environment = process.env) {
  assertLocalVerificationTarget(environment);
  assertBrowserFixtureEnvironment(environment);
  assertApplicationOrigin(environment);
  checkCleanGitWorktree();
  const commit = command("git", ["rev-parse", "HEAD"], { capture: true });
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error("Could not identify the verification commit");
  }
  verifyDockerTarget();
  await assertPortAvailable();

  const migrations = await readLocalMigrationChecksums();
  assertExpectedMigrationCount(migrations);
  const databaseState = classifyDatabaseRelations(
    await readDatabaseRelations(environment),
  );
  assertFreshFixtureDatabase(databaseState);
  let interrupted = null;
  let active = null;
  let appOwned = null;
  const checkInterrupted = () => {
    if (interrupted)
      throw new Error(`Verification interrupted (${interrupted})`);
  };
  const setActive = (value) => {
    active = value;
  };
  const onSignal = (signal) => {
    interrupted ??= signal;
    if (active) signalOwnedGroup(active.child, "SIGTERM");
    if (appOwned && appOwned !== active)
      signalOwnedGroup(appOwned.child, "SIGTERM");
  };
  const onInterrupt = () => onSignal("SIGINT");
  const onTerminate = () => onSignal("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  try {
    console.info(
      "Empty disposable test database confirmed; applying migrations",
    );
    await runOwnedNpm(
      ["run", "db:deploy"],
      environment,
      setActive,
      checkInterrupted,
    );
    checkInterrupted();
    const verifiedCount = await runMigrationChecksumVerification(environment);
    if (verifiedCount !== expectedMigrationCount) {
      throw new Error(
        `Expected ${expectedMigrationCount} exact applied migration checksums`,
      );
    }
    await runOwnedNpm(
      ["run", "build"],
      environment,
      setActive,
      checkInterrupted,
    );
    await assertPortAvailable();
    checkInterrupted();

    const application = startApplication(environment);
    const applicationExited = observeApplication(application);
    appOwned = { child: application, exited: applicationExited };
    setActive(appOwned);
    try {
      await waitForApplication(applicationExited);
      checkInterrupted();
      // The app and fixture writer are independently owned process groups.
      // Keep the app in `active` for signal delivery while the writer runs.
      await runOwnedNpm(
        ["run", "verify:browser:fixtures"],
        environment,
        (writer) => {
          active = writer ?? { child: application, exited: applicationExited };
        },
        checkInterrupted,
      );
      checkInterrupted();
      console.info(
        `Synthetic browser fixtures are ready at commit ${commit}. The local server remains on 127.0.0.1:3000; stop it with Ctrl-C when finished.`,
      );
      await waitForApplicationExit(applicationExited);
      checkInterrupted();
    } finally {
      await cleanupOwnedProcess(application, applicationExited);
      setActive(null);
      appOwned = null;
    }
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    if (active) await cleanupOwnedProcess(active.child, active.exited);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    printUsage();
  } else if (args.length !== 0) {
    console.error("Unrecognized argument; use --help");
    process.exitCode = 1;
  } else {
    launchVerification().catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Verification failed",
      );
      process.exitCode = 1;
    });
  }
}

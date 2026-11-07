import assert from "node:assert/strict";
import {
  createHash,
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp, appendFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import pg from "pg";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";

// Explicitly test-only: source and target must be new task-owned tmpfs servers.
// No --clean, reset, source mutation, production credentials or public dump.
const dockerPrefix = [
  "-u",
  "DOCKER_HOST",
  "-u",
  "DOCKER_CONTEXT",
  "-u",
  "DOCKER_TLS",
  "-u",
  "DOCKER_TLS_VERIFY",
  "-u",
  "DOCKER_CERT_PATH",
  "docker",
  "--host=unix:///var/run/docker.sock",
];
function docker(args, input) {
  return execFileSync("env", [...dockerPrefix, ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 4 * 1024 * 1024,
  });
}
function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}
export async function fingerprintFromEnvironment() {
  verifyPhase9DatabaseIdentity(process.env);
  const client = new pg.Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const names = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'myschoolboard_disposable_verification_marker' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename);
    const tables = [];
    for (const name of names) {
      const quoted = '"' + name.replaceAll('"', '""') + '"';
      const rows = (
        await client.query(
          `SELECT row_to_json(t)::text AS data FROM public.${quoted} t`,
        )
      ).rows
        .map((r) => r.data)
        .sort();
      tables.push({ name, rows: rows.length, sha256: sha(rows.join("\n")) });
    }
    const functions = (
      await client.query(
        "SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)",
      )
    ).rows;
    const indexes = (
      await client.query(
        "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
      )
    ).rows;
    const constraints = (
      await client.query(
        "SELECT t.relname AS tablename,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname<>'myschoolboard_disposable_verification_marker' ORDER BY t.relname,c.conname",
      )
    ).rows;
    await client.query("COMMIT");
    return {
      tables,
      schemaSha256: sha(JSON.stringify({ functions, indexes, constraints })),
    };
  } finally {
    await client.end();
  }
}
async function dumpSource() {
  verifyPhase9DatabaseIdentity(process.env);
  const url = new URL(process.env.TEST_DATABASE_URL);
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.startsWith("PG")) delete env[name];
  Object.assign(env, {
    PGHOST: url.hostname,
    PGPORT: url.port,
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGOPTIONS: "-c default_transaction_read_only=on",
    PGCONNECT_TIMEOUT: "5",
  });
  const child = spawn(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.pipe(process.stdout);
  child.stderr.on("data", () => {});
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code !== 0) throw Error("Private source snapshot failed");
}
async function recovery() {
  const identityFile = process.env.PHASE12_DISPOSABLE_IDENTITY_FILE;
  assert.ok(identityFile && identityFile.startsWith("/workspace/"));
  const source = JSON.parse(await readFile(identityFile, "utf8"));
  assert.equal(source.phase, "phase12");
  assert.match(source.id, /^[a-f0-9]{64}$/);
  const inspected = JSON.parse(docker(["inspect", source.id]))[0];
  assert.equal(inspected.Config.Labels["codex.task"], "phase12");
  assert.deepEqual(inspected.Mounts, []);
  assert.ok(inspected.HostConfig.Tmpfs["/var/lib/postgresql/data"]);
  const runner = JSON.parse(docker(["inspect", source.runner]))[0];
  assert.equal(runner.HostConfig.NetworkMode, "container:" + source.id);
  const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
  assert.equal(source.root, root);
  const script = join(root, "scripts/verify-disposable-recovery.mjs");
  const sourceFingerprint = () =>
    JSON.parse(
      docker(["exec", source.runner, "node", script, "--fingerprint-source"]),
    );
  const before = sourceFingerprint();
  const directory = await mkdtemp("/tmp/msb-recovery-");
  const key = randomBytes(32),
    iv = randomBytes(12);
  const keyFile = join(directory, "recovery.key"),
    artifact = join(directory, "snapshot.aesgcm");
  await writeFile(keyFile, key, { mode: 0o600, flag: "wx" });
  const magic = Buffer.from("MSBDEVBACKUP1");
  await writeFile(artifact, Buffer.concat([magic, iv]), {
    mode: 0o600,
    flag: "wx",
  });
  const child = spawn(
    "env",
    [...dockerPrefix, "exec", source.runner, "node", script, "--dump-source"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderr.on("data", () => {});
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let bytes = 0;
  const bounded = new Transform({
    transform(chunk, encoding, done) {
      bytes += chunk.length;
      done(
        bytes > 32 * 1024 * 1024
          ? Error("Synthetic snapshot size limit")
          : null,
        chunk,
      );
    },
  });
  try {
    await pipeline(
      child.stdout,
      bounded,
      cipher,
      createWriteStream(artifact, { flags: "a", mode: 0o600 }),
    );
    assert.equal(await exited, 0);
  } catch (e) {
    child.kill("SIGTERM");
    throw e;
  }
  await appendFile(artifact, cipher.getAuthTag());
  const encrypted = await readFile(artifact);
  function decrypt(data, secret = key) {
    assert.ok(data.subarray(0, magic.length).equals(magic));
    const d = createDecipheriv(
      "aes-256-gcm",
      secret,
      data.subarray(magic.length, magic.length + 12),
    );
    d.setAuthTag(data.subarray(-16));
    return Buffer.concat([
      d.update(data.subarray(magic.length + 12, -16)),
      d.final(),
    ]);
  }
  const corrupted = Buffer.from(encrypted);
  corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => decrypt(corrupted));
  assert.throws(() => decrypt(encrypted, randomBytes(32)));
  const plain = decrypt(encrypted);
  const label = "phase12-recovery-" + randomUUID(),
    password = randomBytes(24).toString("hex"),
    nonce = randomBytes(32).toString("hex");
  const pgEnv = join(directory, "postgres.env");
  await writeFile(
    pgEnv,
    `POSTGRES_USER=myschoolboard\nPOSTGRES_DB=myschoolboard_test\nPOSTGRES_PASSWORD=${password}\n`,
    { mode: 0o600, flag: "wx" },
  );
  const target = docker([
    "run",
    "-d",
    "--name",
    label,
    "--label",
    "codex.task=phase12-recovery",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
    "--env-file",
    pgEnv,
    "postgres:17-alpine",
  ]).trim();
  const check = JSON.parse(docker(["inspect", target]))[0];
  assert.equal(check.Config.Labels["codex.task"], "phase12-recovery");
  assert.deepEqual(check.Mounts, []);
  assert.ok(check.HostConfig.Tmpfs["/var/lib/postgresql/data"]);
  assert.deepEqual(Object.keys(check.HostConfig.PortBindings ?? {}), []);
  const psql = (sql) =>
    docker(
      [
        "exec",
        "-i",
        target,
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "myschoolboard",
        "-d",
        "myschoolboard_test",
      ],
      sql,
    );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if (
        psql(
          "SELECT count(*) FROM pg_tables WHERE schemaname='public';",
        ).trim() === "0"
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "Only a new empty target is accepted");
  psql(
    `CREATE SCHEMA phase12_restore_attestation;CREATE TABLE phase12_restore_attestation.marker(nonce text NOT NULL);INSERT INTO phase12_restore_attestation.marker VALUES ('${nonce}');`,
  );
  assert.equal(
    psql("SELECT nonce FROM phase12_restore_attestation.marker;").trim(),
    nonce,
  );
  const started = performance.now();
  docker(
    [
      "exec",
      "-i",
      target,
      "pg_restore",
      "--exit-on-error",
      "--no-owner",
      "--no-acl",
      "-U",
      "myschoolboard",
      "-d",
      "myschoolboard_test",
    ],
    plain,
  );
  // Rotate only the disposable verification marker after verified physical restore.
  psql(
    `UPDATE public.myschoolboard_disposable_verification_marker SET nonce='${nonce}' WHERE id='phase9-local';`,
  );
  assert.equal(
    psql("SELECT nonce FROM phase12_restore_attestation.marker;").trim(),
    nonce,
  );
  const envFile = join(directory, "test.env");
  await writeFile(
    envFile,
    `NODE_ENV=test\nTEST_DATABASE_DISPOSABLE=1\nALLOW_DEMO_SEED=1\nDATABASE_URL=postgresql://myschoolboard:${password}@localhost:5434/myschoolboard_test?schema=public\nTEST_DATABASE_URL=postgresql://myschoolboard:${password}@localhost:5434/myschoolboard_test?schema=public\nPHASE9_TEST_DATABASE_NONCE=${nonce}\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3002\nDEV_ADMIN_EMAIL=recovery@myschoolboard.test\nDEV_ADMIN_PASSWORD=Synthetic-recovery-password-42\nPATH=/workspace/shared/disposable-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n`,
    { mode: 0o600, flag: "wx" },
  );
  const relay = `const proxy=require('node:net').createServer(s=>{const u=require('node:net').connect(5432,'127.0.0.1');s.pipe(u);u.pipe(s);s.on('error',()=>u.destroy());u.on('error',()=>s.destroy());});proxy.listen(5434,'127.0.0.1',()=>import(${JSON.stringify(script)}).then(m=>m.fingerprintFromEnvironment()).then(r=>{console.log(JSON.stringify(r));proxy.close();}).catch(()=>{process.exitCode=1;proxy.close();}));`;
  const restored = JSON.parse(
    docker([
      "run",
      "--rm",
      "--network",
      "container:" + target,
      "--user",
      "1000:1000",
      "-v",
      "/workspace:/workspace",
      "-v",
      "/lib/x86_64-linux-gnu:/opt/host-lib:ro",
      "-v",
      "/workspace/phase9-tools/pgclient:/opt/pgclient:ro",
      "--env-file",
      envFile,
      "-w",
      root,
      "node:22-bookworm",
      "node",
      "-e",
      relay,
    ]),
  );
  assert.deepEqual(restored, before);
  assert.deepEqual(sourceFingerprint(), before);
  const result = {
    outcome: "PASS",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    sourceWorkingTreeDirty: !!execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    tablesVerified: before.tables.length,
    rowsVerified: before.tables.reduce((n, t) => n + t.rows, 0),
    schemaAndRowHashesMatch: true,
    encryption: "AES-256-GCM",
    tamperedCiphertextRejected: true,
    wrongKeyRejected: true,
    restoreSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
    targetContainer: target,
    targetDatabaseHostPorts: 0,
    artifactDirectory: directory,
    artifactSha256: sha(encrypted),
    physicalSourceUnchanged: true,
    productionReadiness: false,
  };
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  console.log(JSON.stringify(result));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "--dump-source") await dumpSource();
    else if (process.argv[2] === "--fingerprint-source")
      console.log(JSON.stringify(await fingerprintFromEnvironment()));
    else await recovery();
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : "Recovery verification failed",
    );
    process.exitCode = 1;
  }
}

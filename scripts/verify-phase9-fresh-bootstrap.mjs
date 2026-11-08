import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";

// Create-only Docker test: no existing database URL, volume, or container is accepted.
const name = `phase9-empty-${randomUUID()}`;
const temporary = await mkdtemp("/tmp/phase9-bootstrap-");
const envFile = `${temporary}/postgres.env`;
await writeFile(
  envFile,
  `POSTGRES_PASSWORD=${randomUUID()}\nPOSTGRES_USER=myschoolboard\nPOSTGRES_DB=myschoolboard_test\n`,
  { mode: 0o600 },
);
function docker(args, input) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 4 * 1024 * 1024,
  });
}
try {
  const id = docker([
    "run",
    "-d",
    "--name",
    name,
    "--label",
    "codex.task=phase9-fresh-bootstrap",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
    "--env-file",
    envFile,
    "postgres:17-alpine",
  ]).trim();
  const details = JSON.parse(docker(["inspect", id]))[0];
  assert.equal(details.Name, `/${name}`);
  assert.equal(details.Config.Labels["codex.task"], "phase9-fresh-bootstrap");
  assert.deepEqual(details.Mounts, []);
  assert.deepEqual(Object.keys(details.HostConfig.PortBindings ?? {}), []);
  assert.ok(details.HostConfig.Tmpfs["/var/lib/postgresql/data"]);
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker([
        "exec",
        id,
        "pg_isready",
        "-U",
        "myschoolboard",
        "-d",
        "myschoolboard_test",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(ready, "Fresh PostgreSQL must become ready");
  const psql = (sql) =>
    docker(
      [
        "exec",
        "-i",
        id,
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
  assert.equal(
    psql("SELECT count(*) FROM pg_tables WHERE schemaname='public';").trim(),
    "0",
  );
  const nonce = randomUUID();
  psql(
    `CREATE TABLE myschoolboard_disposable_verification_marker(id text PRIMARY KEY, nonce text NOT NULL);INSERT INTO myschoolboard_disposable_verification_marker VALUES ('phase9-local','${nonce}');`,
  );
  assert.equal(
    psql(
      "SELECT nonce FROM myschoolboard_disposable_verification_marker WHERE id='phase9-local';",
    ).trim(),
    nonce,
  );
  psql(
    'CREATE TABLE "_prisma_migrations" (id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0);',
  );
  const names = (
    await readdir(new URL("../prisma/migrations/", import.meta.url))
  )
    .filter((n) => /^\d/.test(n))
    .sort();
  assert.equal(names.length, 60);
  for (const migration of names) {
    assert.match(migration, /^[A-Za-z0-9_]+$/);
    const sql = await readFile(
      new URL(
        `../prisma/migrations/${migration}/migration.sql`,
        import.meta.url,
      ),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    psql(
      `BEGIN;\n${sql}\nINSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ('${randomUUID()}','${checksum}','${migration}',clock_timestamp(),1);COMMIT;`,
    );
    assert.equal(
      psql(
        `SELECT checksum FROM "_prisma_migrations" WHERE migration_name='${migration}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`,
      ).trim(),
      checksum,
    );
  }
  assert.equal(psql('SELECT count(*) FROM "_prisma_migrations";').trim(), "60");
  console.log(
    JSON.stringify({
      outcome: "PASS",
      migrations: 60,
      container: name,
      id,
      storage: "new tmpfs",
      publishedPorts: 0,
      method: "psql SQL execution, not Prisma CLI",
    }),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

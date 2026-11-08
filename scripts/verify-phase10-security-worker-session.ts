import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { currentLocalWorkerUser } from "@/src/modules/notifications/local-worker-session";
import { prisma } from "@/src/lib/db";
verifyPhase9DatabaseIdentity(process.env);
const [file, mode, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(file ?? "", /^\/tmp\/phase10-security-worker-[\w-]+\.json$/);
assert.ok(["--allowed", "--denied"].includes(mode));
try {
  const f = JSON.parse(await readFile(file, "utf8"));
  assert.equal(await currentLocalWorkerUser(f.cookie), f.userId);
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/run-phase10-security-worker.ts", "--once"],
    {
      env: { ...process.env, PHASE10_OPERATOR_COOKIE: f.cookie },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.equal(child.status, mode === "--allowed" ? 0 : 1);
  if (mode === "--allowed")
    assert.match(child.stdout, /security_inapp_batch_complete/);
  else assert.match(child.stderr, /Security worker stopped/);
  console.log(
    mode === "--allowed"
      ? "Authenticated security CLI pass"
      : "Current platform-role revocation stops security CLI pass",
  );
} finally {
  await prisma.$disconnect();
}

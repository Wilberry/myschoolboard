import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
verifyPhase9DatabaseIdentity(process.env);
const tag = randomUUID(),
  school = "p10-boundary-cli-" + tag,
  password = "Synthetic-only-" + randomUUID(),
  email = "p10-boundary-cli-" + tag + "@example.test";
let userId: string | undefined;
try {
  const made = await auth.api.signUpEmail({
    body: { email, password, name: "Synthetic boundary CLI operator" },
  });
  userId = made.user.id;
  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: "SUPER_ADMIN" },
  });
  await prisma.school.create({
    data: {
      id: school,
      slug: school,
      name: "Synthetic inactive boundary CLI school",
      isActive: false,
      lifecycleStatus: "PENDING",
    },
  });
  const plan = await prisma.platformPlanRevision.create({
    data: {
      code: "p10-boundary-" + tag.slice(0, 16),
      version: 1,
      name: "Synthetic CLI plan",
      features: ["ATTENDANCE"],
      reason: "Isolated worker execution fixture",
      actorUserId: userId,
    },
  });
  const period = await prisma.schoolSubscriptionPeriod.create({
    data: {
      schoolId: school,
      planRevisionId: plan.id,
      startsAt: new Date(Date.now() - 7200000),
      endsAt: new Date(Date.now() - 3600000),
      reason: "Isolated persisted expiry fixture",
      actorUserId: userId,
    },
  });
  const signed = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = signed.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const run = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/run-phase10-boundary-worker.ts", "--once"],
      {
        cwd: process.cwd(),
        env: { ...process.env, PHASE10_OPERATOR_COOKIE: cookie },
        encoding: "utf8",
        timeout: 15000,
      },
    );
  const first = run();
  assert.equal(
    first.status,
    0,
    "Current platform operator must execute the actual CLI",
  );
  assert.match(first.stdout, /subscription_boundary_batch_complete/);
  assert.equal(
    await prisma.subscriptionBoundaryEvent.count({
      where: { schoolId: school, periodId: period.id },
    }),
    1,
  );
  const again = run();
  assert.equal(again.status, 0);
  assert.equal(
    await prisma.subscriptionBoundaryEvent.count({
      where: { schoolId: school, periodId: period.id },
    }),
    1,
  );
  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: "NONE" },
  });
  const revoked = run();
  assert.equal(revoked.status, 1);
  assert.match(revoked.stderr, /Boundary worker stopped/);
  console.log(
    "Actual authenticated boundary CLI: first observation, duplicate pass and still-signed-in platform-role revocation PASS",
  );
} catch {
  console.error(
    "Synthetic boundary CLI verification failed; no credentials recorded.",
  );
  process.exitCode = 1;
} finally {
  await prisma.school.deleteMany({ where: { id: school } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}

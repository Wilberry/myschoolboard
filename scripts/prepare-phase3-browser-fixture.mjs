import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertPhase3BrowserFixturePolicy } from "./phase3-browser-fixture-policy.mjs";
import { assertLocalDockerFixtureTarget } from "./browser-fixture-safety.mjs";
import { runMigrationChecksumVerification } from "./verify-migration-checksums.mjs";
import { verifyCleanGitHead } from "./verify-phase3-subscription-migration-preflight.mjs";

// This script is intentionally separate from production onboarding.
// Direct platform-role fixture assignment is permitted ONLY in the verified
// disposable test DB with a distinct write opt-in. No reset or cleanup.
const root = fileURLToPath(new URL("../", import.meta.url));

function command(executable, args) {
  const r = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    shell: false,
  });
  if (r.error || r.status !== 0 || r.signal) {
    throw new Error("Synthetic fixture safety command failed");
  }
  return r.stdout.trim();
}

function assertExactDocker() {
  const context = command("docker", ["context", "show"]);
  const endpoint = command("docker", [
    "context",
    "inspect",
    context,
    "--format",
    "{{.Endpoints.docker.Host}}",
  ]);
  const ids = command("docker", [
    "compose",
    "--profile",
    "test",
    "ps",
    "-q",
    "postgres-test",
  ])
    .split("\n")
    .filter(Boolean);
  if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/i.test(ids[0])) {
    throw new Error("Exactly one matching local test container required");
  }
  const data = JSON.parse(command("docker", ["inspect", ids[0]]));
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Unexpected Docker test inspection result");
  }
  assertLocalDockerFixtureTarget(endpoint, data[0], root);
}

async function main() {
  const fixture = assertPhase3BrowserFixturePolicy();
  if (
    command("git", ["branch", "--show-current"]) !==
    "verify/pr97-integrated-pupil-workflow"
  ) {
    throw new Error("Wrong Phase 1–7 integration worktree branch");
  }
  const commit = verifyCleanGitHead();
  assertExactDocker();
  const migrationCount = await runMigrationChecksumVerification();
  if (migrationCount !== 37) {
    throw new Error("Require 37 exact already-applied migration checksums");
  }

  // Import only AFTER every safety precondition passes.
  const { prisma } = await import("../src/lib/db.ts");
  try {
    const { auth } = await import("../src/lib/auth.ts");
    const existing = await Promise.all([
      prisma.user.count({
        where: {
          email: { in: [fixture.operatorEmail, fixture.schoolAdminEmail] },
        },
      }),
      prisma.school.count({
        where: { slug: { in: fixture.schoolSlugs } },
      }),
    ]);
    if (existing.some((count) => count !== 0)) {
      throw new Error("Fixture run ID already in use; choose a new run ID");
    }

    // Better Auth creates two new synthetic users. Do NOT elevate any
    // preexisting account or reuse an existing school.
    const password = process.env.PHASE3_BROWSER_PASSWORD;
    const operator = await auth.api.signUpEmail({
      body: {
        name: `Synthetic Phase 3 Operator ${fixture.runId}`,
        email: fixture.operatorEmail,
        password,
      },
    });
    const schoolAdmin = await auth.api.signUpEmail({
      body: {
        name: `Synthetic Phase 3 School Admin ${fixture.runId}`,
        email: fixture.schoolAdminEmail,
        password,
      },
    });

    const result = await prisma.$transaction(
      async (tx) => {
        const platformActor = await tx.user.update({
          where: { id: operator.user.id, email: fixture.operatorEmail },
          data: { platformRole: "SUPER_ADMIN" },
          select: { id: true, platformRole: true },
        });
        const a = await tx.school.create({
          data: {
            slug: fixture.schoolSlugs[0],
            name: `Synthetic Phase 3 School A ${fixture.runId}`,
            lifecycleStatus: "PENDING",
            isActive: false,
          },
          select: {
            id: true,
            slug: true,
            lifecycleStatus: true,
            isActive: true,
          },
        });
        const b = await tx.school.create({
          data: {
            slug: fixture.schoolSlugs[1],
            name: `Synthetic Phase 3 School B ${fixture.runId}`,
            lifecycleStatus: "SUSPENDED",
            isActive: false,
          },
          select: {
            id: true,
            slug: true,
            lifecycleStatus: true,
            isActive: true,
          },
        });
        const membership = await tx.membership.create({
          data: {
            schoolId: a.id,
            userId: schoolAdmin.user.id,
            role: "SCHOOL_ADMIN",
          },
          select: { id: true, schoolId: true, role: true },
        });
        return { platformActor, schools: [a, b], membership };
      },
      { isolationLevel: "Serializable", maxWait: 15000, timeout: 60000 },
    );
    if (
      result.platformActor.platformRole !== "SUPER_ADMIN" ||
      result.membership.role !== "SCHOOL_ADMIN"
    ) {
      throw new Error("Synthetic fixture role verification failed");
    }
    console.info(
      JSON.stringify({
        event: "phase3_synthetic_browser_fixture_ready",
        runId: fixture.runId,
        testedCommit: commit,
        migrationCount,
        schools: result.schools,
        accounts: {
          platform: fixture.operatorEmail,
          schoolAdmin: fixture.schoolAdminEmail,
        },
        password: "Stored in private PHASE3_BROWSER_PASSWORD only",
        nextStep:
          "Run browser checks; write plan/periods only through authorized UI",
        acceptance: "FIXTURE_ONLY_NOT_BROWSER_ACCEPTED",
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Error objects may contain connection strings or cookies. Never print.
  console.error(
    JSON.stringify({
      event: "phase3_synthetic_browser_fixture_blocked",
      errorType: error instanceof Error ? error.name : "unknown",
      warning: "Do not rerun a partially created fixture; use a fresh run ID",
    }),
  );
  process.exitCode = 1;
});

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { MembershipRole } from "@prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import {
  assertBrowserFixtureEnvironment,
  assertLocalDockerFixtureTarget,
} from "./browser-fixture-safety.mjs";
import {
  runMigrationChecksumVerification,
} from "./verify-migration-checksums.mjs";

/**
 * Explicitly opted-in synthetic identity/academic setup for manual browser
 * verification only. This is not a production onboarding, admission, audit
 * or academic approval workflow. Never run against a shared database.
 */
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function docker(args: string[]) {
  const result = spawnSync("docker", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Could not independently verify local Docker test service");
  }
  return result.stdout.trim();
}

function assertDockerTarget() {
  const context = docker(["context", "show"]);
  const endpoint = docker([
    "context",
    "inspect",
    context,
    "--format",
    "{{.Endpoints.docker.Host}}",
  ]);
  const ids = docker([
    "compose",
    "--profile",
    "test",
    "ps",
    "-q",
    "postgres-test",
  ]).split("\n");
  if (ids.length !== 1 || !ids[0]) {
    throw new Error("Expected exactly one Compose postgres-test container");
  }
  const inspected = JSON.parse(docker(["inspect", ids[0]]));
  if (!Array.isArray(inspected) || inspected.length !== 1) {
    throw new Error("Unexpected Docker inspection result");
  }
  assertLocalDockerFixtureTarget(endpoint, inspected[0], repositoryRoot);
}

type FixtureActor = {
  key: string;
  school: "a" | "b" | null;
  role: MembershipRole | null;
};

const actors: FixtureActor[] = [
  { key: "adminA", school: "a", role: "SCHOOL_ADMIN" },
  { key: "superA", school: "a", role: "SCHOOL_SUPER_ADMIN" },
  { key: "teacherA", school: "a", role: "TEACHER" },
  { key: "headA", school: "a", role: "HEAD_OF_SECTION" },
  { key: "principalA", school: "a", role: "PRINCIPAL" },
  { key: "studentA", school: "a", role: "STUDENT" },
  { key: "unlinkedA", school: "a", role: "STUDENT" },
  { key: "parentA", school: "a", role: "PARENT" },
  { key: "adminB", school: "b", role: "SCHOOL_ADMIN" },
  { key: "outsider", school: null, role: null },
];

async function main() {
  assertBrowserFixtureEnvironment();
  assertDockerTarget();

  // Check exact local migration history before creating any synthetic data.
  await runMigrationChecksumVerification();
  const runId = process.env.BROWSER_FIXTURE_RUN_ID!;
  const password = process.env.BROWSER_FIXTURE_PASSWORD!;
  const slugA = `browser-${runId}-a`;
  const slugB = `browser-${runId}-b`;
  const emailOf = (key: string) => `${runId}-${key}@myschoolboard.test`;

  const [existingSchools, existingUsers] = await Promise.all([
    prisma.school.count({ where: { slug: { in: [slugA, slugB] } } }),
    prisma.user.count({
      where: { email: { in: actors.map((actor) => emailOf(actor.key)) } },
    }),
  ]);
  if (existingSchools !== 0 || existingUsers !== 0) {
    throw new Error(
      "Browser fixture run ID already used; select a new synthetic run ID",
    );
  }

  const users: Record<string, string> = {};
  for (const actor of actors) {
    const created = await auth.api.signUpEmail({
      body: {
        email: emailOf(actor.key),
        name: `Synthetic Browser ${actor.key}`,
        password,
      },
    });
    users[actor.key] = created.user.id;
  }

  const year = new Date().getUTCFullYear();
  const startsOn = new Date(Date.UTC(year, 0, 1));
  const endsOn = new Date(Date.UTC(year + 1, 11, 31));
  const fixture = await prisma.$transaction(
    async (tx) => {
      const schoolA = await tx.school.create({
        data: { slug: slugA, name: `Synthetic Browser A ${runId}` },
      });
      const schoolB = await tx.school.create({
        data: { slug: slugB, name: `Synthetic Browser B ${runId}` },
      });
      const memberships: Record<string, string> = {};
      for (const actor of actors) {
        if (actor.school === null || actor.role === null) continue;
        const membership = await tx.membership.create({
          data: {
            userId: users[actor.key],
            schoolId: actor.school === "a" ? schoolA.id : schoolB.id,
            role: actor.role,
          },
        });
        memberships[actor.key] = membership.id;
      }

      const primary = await tx.schoolSection.create({
        data: {
          schoolId: schoolA.id,
          name: "Synthetic Primary",
          stage: "PRIMARY",
        },
      });
      const secondary = await tx.schoolSection.create({
        data: {
          schoolId: schoolA.id,
          name: "Synthetic Secondary",
          stage: "SECONDARY",
        },
      });
      const primaryClass = await tx.schoolClass.create({
        data: {
          schoolId: schoolA.id,
          name: "Synthetic Primary Five",
          sectionId: primary.id,
        },
      });
      const secondaryClass = await tx.schoolClass.create({
        data: {
          schoolId: schoolA.id,
          name: "Synthetic Secondary One",
          sectionId: secondary.id,
        },
      });
      const subject = await tx.subject.create({
        data: { schoolId: schoolA.id, name: "Synthetic Mathematics" },
      });
      const session = await tx.academicSession.create({
        data: {
          schoolId: schoolA.id,
          name: `Synthetic ${year}/${year + 1}`,
          startsOn,
          endsOn,
          status: "ACTIVE",
        },
      });
      const term = await tx.academicTerm.create({
        data: {
          schoolId: schoolA.id,
          sessionId: session.id,
          name: "Synthetic Browser Term",
          position: 1,
          startsOn,
          endsOn,
          status: "ACTIVE",
        },
      });

      const assignmentA = await tx.teacherClassSubjectAssignment.create({
        data: {
          schoolId: schoolA.id,
          sessionId: session.id,
          membershipId: memberships.teacherA,
          classId: primaryClass.id,
          subjectId: subject.id,
        },
      });
      const assignmentOther = await tx.teacherClassSubjectAssignment.create({
        data: {
          schoolId: schoolA.id,
          sessionId: session.id,
          membershipId: memberships.teacherA,
          classId: secondaryClass.id,
          subjectId: subject.id,
        },
      });
      const headGrant = await tx.scopeGrant.create({
        data: {
          membershipId: memberships.headA,
          type: "SECTION",
          scopeId: primary.id,
          verified: true,
        },
      });
      const principalGrant = await tx.scopeGrant.create({
        data: {
          membershipId: memberships.principalA,
          type: "SECTION",
          scopeId: secondary.id,
          verified: true,
        },
      });

      return {
        schools: { a: schoolA.id, b: schoolB.id },
        sections: { primary: primary.id, secondary: secondary.id },
        classes: { primary: primaryClass.id, secondary: secondaryClass.id },
        sessionId: session.id,
        termId: term.id,
        assignments: {
          primary: assignmentA.id,
          secondary: assignmentOther.id,
        },
        grants: { head: headGrant.id, principal: principalGrant.id },
        memberships,
      };
    },
    { maxWait: 15_000, timeout: 60_000 },
  );

  console.info(
    JSON.stringify({
      event: "synthetic_browser_fixture_ready",
      runId,
      database: "myschoolboard_test",
      schoolSlugs: { a: slugA, b: slugB },
      ...fixture,
      accounts: Object.fromEntries(
        actors.map((actor) => [
          actor.key,
          { email: emailOf(actor.key), role: actor.role },
        ]),
      ),
      password: "Set only in BROWSER_FIXTURE_PASSWORD; never print or commit",
      pendingWorkflows: [
        "Register and enroll synthetic pupils using the authorized school UI",
        "Attest and revoke student account links through school-admin routes",
        "Submit and approve lesson notes using actual teacher/reviewer routes",
        "Release approved revisions via the reviewer workflow",
        "Run browser access checks before and after synthetic revocations",
      ],
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "synthetic_browser_fixture_failed",
        errorType: error instanceof Error ? error.name : "unknown",
        note: "Check fixtures by run ID; never assume a failed run is empty",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

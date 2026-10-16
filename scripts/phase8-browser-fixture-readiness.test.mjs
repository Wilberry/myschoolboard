import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertBrowserFixtureTarget,
  inspectBrowserFixture,
  summarizeBrowserFixture,
} from "./phase8-browser-fixture-readiness.mjs";

const env = {
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL:
    "postgresql://myschoolboard:synthetic@localhost:5434/myschoolboard_test?schema=public",
  TEST_DATABASE_URL:
    "postgresql://myschoolboard:synthetic@localhost:5434/myschoolboard_test?schema=public",
  BETTER_AUTH_SECRET: "synthetic-very-long-test-only-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  DEV_ADMIN_EMAIL: "admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "synthetic-only-password",
  PHASE8_REPORT_RELEASE_ENABLED: "false",
  PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "false",
  PHASE8_BROWSER_SCHOOL_ID: "synthetic-school-a",
};

test("rejects unsafe synthetic fixture database targets", () => {
  assert.equal(assertBrowserFixtureTarget(env), "synthetic-school-a");
  for (const patch of [
    { NODE_ENV: "production" },
    { DATABASE_URL: "postgresql://prod.example/postgres" },
    { PHASE8_REPORT_RELEASE_ENABLED: "true" },
    { PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "true" },
    { PHASE8_BROWSER_SCHOOL_ID: "../foreign" },
    { PHASE8_BROWSER_SCHOOL_ID: "" },
    {
      TEST_DATABASE_URL: env.TEST_DATABASE_URL.replace("public", "other"),
      DATABASE_URL: env.DATABASE_URL.replace("public", "other"),
    },
  ]) {
    assert.throws(() => assertBrowserFixtureTarget({ ...env, ...patch }));
  }
});

const baseline = {
  schoolActive: true,
  policy: { id: "p", mode: "GUARDIAN_FIRST_ACK" },
  release: { visibilityPolicyId: "p", studentCount: 1 },
  linkedParentChildIds: ["child-a"],
  linkedStudentChildIds: ["child-a"],
};

test("guardian-first needs same child and current release", () => {
  assert.equal(summarizeBrowserFixture(baseline).browserFixtureReady, true);
  for (const patch of [
    { schoolActive: false },
    { policy: { id: "p2", mode: "GUARDIAN_FIRST_ACK" } },
    { release: null },
    { release: { visibilityPolicyId: "p", studentCount: 0 } },
    {
      linkedParentChildIds: ["child-a"],
      linkedStudentChildIds: ["child-b"],
    },
    { linkedParentChildIds: [] },
  ]) {
    const next = summarizeBrowserFixture({ ...baseline, ...patch });
    assert.equal(next.browserFixtureReady, false);
  }
});

test("distinguishes all school recipient policy modes", () => {
  for (const [mode, parents, students, ready] of [
    ["STUDENT_ONLY", [], ["child-a"], true],
    ["STUDENT_ONLY", ["child-a"], [], false],
    ["GUARDIAN_ONLY", ["child-a"], [], true],
    ["GUARDIAN_ONLY", [], ["child-a"], false],
    ["SCHOOL_ONLY", ["child-a"], ["child-a"], false],
  ]) {
    const next = summarizeBrowserFixture({
      ...baseline,
      policy: { id: "p", mode },
      linkedParentChildIds: parents,
      linkedStudentChildIds: students,
    });
    assert.equal(next.browserFixtureReady, ready);
  }
});

test("queries active, school-bound unrevoked links only", async () => {
  const queries = [];
  const database = {
    school: {
      findUnique: async (args) => {
        queries.push(["school", args]);
        return { isActive: true };
      },
    },
    reportVisibilityPolicyRevision: {
      findFirst: async (args) => {
        queries.push(["policy", args]);
        return baseline.policy;
      },
    },
    guardianStudentLink: {
      findMany: async (args) => {
        queries.push(["guardian", args]);
        return [{ studentId: "child-a" }];
      },
    },
    studentAccountLink: {
      findMany: async (args) => {
        queries.push(["student", args]);
        return [{ studentId: "child-a" }];
      },
    },
    reportRecipientRelease: {
      findFirst: async (args) => {
        queries.push(["release", args]);
        return baseline.release;
      },
    },
  };
  const summary = await inspectBrowserFixture(database, "synthetic-school-a");
  assert.equal(summary.browserFixtureReady, true);
  assert.equal(queries.length, 5);
  for (const [, query] of queries) {
    assert.equal(query.where.schoolId ?? query.where.id, "synthetic-school-a");
  }
  assert.deepEqual(queries.find(([name]) => name === "guardian")[1].where, {
    schoolId: "synthetic-school-a",
    revocation: null,
    guardian: { isActive: true, role: "PARENT" },
  });
  assert.deepEqual(queries.find(([name]) => name === "student")[1].where, {
    schoolId: "synthetic-school-a",
    revocation: null,
    studentMembership: { isActive: true, role: "STUDENT" },
  });
});

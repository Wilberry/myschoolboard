import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertBrowserComposeConfig,
  assertLocalDockerHost,
  assertNoLeaks,
  assertRecipientBrowserTarget,
  assertSignedInRecipientLink,
  assertSyntheticSessionUser,
} from "./phase8-recipient-browser-acceptance.mjs";

const safe = {
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
  DEV_ADMIN_PASSWORD: "synthetic-test-only-password",
  PHASE8_BROWSER_DISPOSABLE_ACK: "I_CONFIRMED_LOCAL_TEST_DB",
  PHASE8_REPORT_RELEASE_ENABLED: "true",
  PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "true",
  PHASE8_BROWSER_SCHOOL_ID: "synthetic-school-a",
  PHASE8_BROWSER_STUDENT_ID: "synthetic-child-a",
  PHASE8_BROWSER_EXPECT_MODE: "GUARDIAN_FIRST_ACK",
  PHASE8_BROWSER_PARENT_EMAIL: "synthetic-parent@example.test",
  PHASE8_BROWSER_PARENT_PASSWORD: "synthetic-parent-password",
  PHASE8_BROWSER_STUDENT_EMAIL: "synthetic-student@example.test",
  PHASE8_BROWSER_STUDENT_PASSWORD: "synthetic-student-password",
  PHASE8_BROWSER_PLAYWRIGHT_ENTRY:
    "/tmp/myschoolboard-browser-tools/node_modules/playwright/index.mjs",
};

test("rejects unsafe browser targets and nonsynthetic users", () => {
  assert.equal(
    assertRecipientBrowserTarget(safe).schoolId,
    "synthetic-school-a",
  );
  for (const patch of [
    { TEST_DATABASE_DISPOSABLE: "0" },
    { NODE_ENV: "production" },
    { PHASE8_BROWSER_DISPOSABLE_ACK: "" },
    { PHASE8_REPORT_RELEASE_ENABLED: "false" },
    { PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "false" },
    { PHASE8_BROWSER_SCHOOL_ID: "../foreign" },
    { PHASE8_BROWSER_PARENT_EMAIL: "real@example.com" },
    { PHASE8_BROWSER_STUDENT_EMAIL: "real@example.com" },
    { PHASE8_BROWSER_PLAYWRIGHT_ENTRY: "../playwright" },
    { BETTER_AUTH_URL: "https://public.example/" },
  ]) {
    assert.throws(() => assertRecipientBrowserTarget({ ...safe, ...patch }));
  }
});

test("rejects remote Docker contexts even with apparent loopback port", () => {
  assert.doesNotThrow(() => assertLocalDockerHost("unix:///var/run/docker.sock"));
  assert.doesNotThrow(() => assertLocalDockerHost(
    "unix:///home/test/.docker/desktop/docker.sock",
    "unix:///var/run/docker.sock",
  ));
  for (const endpoint of [
    "",
    "ssh://remote-host",
    "tcp://127.0.0.1:2375",
    "tcp://remote-host:2376",
    "https://remote-host",
  ]) {
    assert.throws(() => assertLocalDockerHost(endpoint));
  }
  assert.throws(() =>
    assertLocalDockerHost("unix:///var/run/docker.sock", "ssh://remote-host"));
});

test("browser acceptance refuses non-disposable Docker Compose storage", () => {
  const allowed = {
    services: {
      "postgres-test": {
        tmpfs: ["/var/lib/postgresql/data:rw,noexec,nosuid,size=256m"],
        ports: [
          { host_ip: "127.0.0.1", published: "5434", target: 5432 },
        ],
      },
    },
  };
  assert.doesNotThrow(() => assertBrowserComposeConfig(allowed));
  for (const service of [
    { tmpfs: [], ports: allowed.services["postgres-test"].ports },
    {
      tmpfs: allowed.services["postgres-test"].tmpfs,
      ports: [{ host_ip: "0.0.0.0", published: "5434", target: 5432 }],
    },
    {
      tmpfs: allowed.services["postgres-test"].tmpfs,
      ports: [{ host_ip: "127.0.0.1", published: "5433", target: 5432 }],
    },
  ]) {
    assert.throws(() => assertBrowserComposeConfig({
      services: { "postgres-test": service },
    }));
  }
});

test("guardian-first needs explicit receipt before student access", () => {
  const one = (role, mode = "GUARDIAN_FIRST_ACK") => [
    {
      studentId: "synthetic-child-a",
      recipientRole: role,
      policyMode: mode,
      gradeCode: "A",
    },
  ];
  const child = "synthetic-child-a";
  assert.doesNotThrow(() => {
    assertNoLeaks(one("PARENT"), child, "PARENT", "GUARDIAN_FIRST_ACK", false);
    assertNoLeaks([], child, "STUDENT", "GUARDIAN_FIRST_ACK", false);
    assertNoLeaks(one("STUDENT"), child, "STUDENT", "GUARDIAN_FIRST_ACK", true);
    assertNoLeaks(one("STUDENT", "STUDENT_ONLY"), child, "STUDENT", "STUDENT_ONLY", false);
    assertNoLeaks([], child, "PARENT", "STUDENT_ONLY", false);
  });
  assert.throws(() =>
    assertNoLeaks(one("STUDENT"), child, "STUDENT", "GUARDIAN_FIRST_ACK", false),
  );
  assert.throws(() =>
    assertNoLeaks(one("PARENT"), child, "PARENT", "STUDENT_ONLY", false),
  );
});

test("rejects foreign child, leaked answers and role mismatch", () => {
  const base = {
    studentId: "synthetic-child-a",
    recipientRole: "PARENT",
    policyMode: "GUARDIAN_ONLY",
  };
  for (const modified of [
    { studentId: "other-child" },
    { recipientRole: "STUDENT" },
    { policyMode: "STUDENT_ONLY" },
    { correctIndex: 2 },
    { studentSourceCards: {} },
    { composedStudentCards: [] },
    { earnedPoints: 7 },
  ]) {
    assert.throws(() =>
      assertNoLeaks(
        [{ ...base, ...modified }],
        "synthetic-child-a",
        "PARENT",
        "GUARDIAN_ONLY",
        false,
      ),
    );
  }
});

test("allows receipt writes only under guardian-first mode", () => {
  assert.doesNotThrow(() =>
    assertRecipientBrowserTarget({
      ...safe,
      PHASE8_BROWSER_ALLOW_RECEIPT_WRITE: "1",
    }),
  );
  assert.throws(() =>
    assertRecipientBrowserTarget({
      ...safe,
      PHASE8_BROWSER_EXPECT_MODE: "STUDENT_ONLY",
      PHASE8_BROWSER_ALLOW_RECEIPT_WRITE: "1",
    }),
  );
});

test("session must prove actual student or parent identity, not an empty grade GET", () => {
  const email = "synthetic-student@example.test";
  assert.equal(
    assertSyntheticSessionUser({ user: { id: "uid-1", email } }, email),
    "uid-1",
  );
  for (const payload of [
    null,
    {},
    { user: { id: "", email } },
    { user: { id: "../invalid", email } },
    { user: { id: "uid-1", email: "unrelated@example.test" } },
  ]) {
    assert.throws(() => assertSyntheticSessionUser(payload, email));
  }
});

test("each signed-in role requires its own current attested exact-child link", async () => {
  const calls = [];
  const database = {
    membership: {
      findFirst: async (args) => {
        calls.push(["membership", args]);
        return { id: "member-a" };
      },
    },
    guardianStudentLink: {
      findFirst: async (args) => {
        calls.push(["parent", args]);
        return { id: "link-parent" };
      },
    },
    studentAccountLink: {
      findFirst: async (args) => {
        calls.push(["student", args]);
        return { id: "link-student" };
      },
    },
  };
  for (const [role, kind, field] of [
    ["PARENT", "parent", "guardianMembershipId"],
    ["STUDENT", "student", "studentMembershipId"],
  ]) {
    await assertSignedInRecipientLink(
      database,
      "school-a",
      "child-a",
      role,
      "login-a",
    );
    const membership = calls.findLast(([name]) => name === "membership")[1];
    assert.deepEqual(membership.where, {
      schoolId: "school-a",
      userId: "login-a",
      role,
      isActive: true,
      school: { isActive: true },
    });
    const linked = calls.findLast(([name]) => name === kind)[1];
    assert.deepEqual(linked.where, {
      schoolId: "school-a",
      studentId: "child-a",
      revocation: null,
      student: {
        status: "ENROLLED",
        enrollments: { some: { schoolId: "school-a", status: "ACTIVE" } },
      },
      [field]: "member-a",
    });
  }
  await assert.rejects(
    assertSignedInRecipientLink(
      database,
      "school-a",
      "child-a",
      "SCHOOL_SUPER_ADMIN",
      "login-a",
    ),
  );
  await assert.rejects(
    assertSignedInRecipientLink(
      { ...database, membership: { findFirst: async () => null } },
      "school-a",
      "child-a",
      "STUDENT",
      "login-a",
    ),
  );
  for (const role of ["PARENT", "STUDENT"]) {
    await assert.rejects(
      assertSignedInRecipientLink(
        {
          ...database,
          [role === "PARENT" ? "guardianStudentLink" : "studentAccountLink"]:
            { findFirst: async () => null },
        },
        "school-a",
        "child-a",
        role,
        "login-a",
      ),
    );
  }
});

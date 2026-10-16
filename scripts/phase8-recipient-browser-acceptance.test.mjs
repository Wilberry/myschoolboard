import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertNoLeaks,
  assertRecipientBrowserTarget,
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

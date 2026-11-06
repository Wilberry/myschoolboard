import { test } from "node:test";
import assert from "node:assert/strict";
import { browserFixtureEmail } from "./browser-fixture-email.mjs";

const runId = "browser-oct22a";
const actors = [
  "adminA",
  "superA",
  "teacherA",
  "headA",
  "principalA",
  "studentA",
  "unlinkedA",
  "parentA",
  "adminB",
  "outsider",
];

test("all ten fixture actors map to unique lowercase stored emails", () => {
  const values = actors.map((actor) => browserFixtureEmail(runId, actor));
  assert.equal(new Set(values).size, 10);
  for (const value of values) {
    assert.equal(value, value.toLowerCase());
    assert.match(value, /^browser-oct22a-[a-z]+@myschoolboard\.test$/);
  }
});

test("mixed-case actor keys resolve to expected normalized account", () => {
  const stored = new Map([
    ["browser-oct22a-admina@myschoolboard.test", "synthetic-admin"],
    ["browser-oct22a-studenta@myschoolboard.test", "synthetic-student"],
    ["browser-oct22a-adminb@myschoolboard.test", "synthetic-foreign"],
  ]);
  assert.equal(
    stored.get(browserFixtureEmail(runId, "adminA")),
    "synthetic-admin",
  );
  assert.equal(
    stored.get(browserFixtureEmail(runId, "studentA")),
    "synthetic-student",
  );
  assert.equal(
    stored.get(browserFixtureEmail(runId, "adminB")),
    "synthetic-foreign",
  );
});

test("rejects invalid run labels instead of querying arbitrary emails", () => {
  for (const value of ["", "TEST-RUN", "../escape", "abc", "x".repeat(27)]) {
    assert.throws(() => browserFixtureEmail(value, "adminA"), /Invalid/);
  }
});

test("rejects unknown or different-cased actor keys", () => {
  for (const value of ["admina", "AdminA", "other", "", undefined]) {
    assert.throws(() => browserFixtureEmail(runId, value), /Invalid/);
  }
});

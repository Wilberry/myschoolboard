import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const client = read("src/components/student-lessons-editor.tsx");
const page = read("app/schools/[schoolId]/my-lessons/page.tsx");
const route = read("app/api/schools/[schoolId]/student-lessons/route.ts");

test("student lesson UI conceals content on tab hiding and BFCache restoration", () => {
  assert.match(client, /privatePanel\.current\.hidden = true/);
  assert.match(client, /setAuthorized\(false\)/);
  assert.match(client, /hidden=\{!authorized\}/);
  assert.match(client, /setActive\(null\)/);
  assert.match(client, /setLessons\(\[\]\)/);
  for (const event of [
    "visibilitychange",
    "focus",
    "blur",
    "pageshow",
    "pagehide",
  ]) {
    assert.ok(client.includes('addEventListener("' + event + '"'));
    assert.ok(client.includes('removeEventListener("' + event + '"'));
  }
  assert.match(client, /window\.setInterval\(/);
  assert.match(client, /RECHECK_MS = 10_000/);
  assert.match(client, /REQUEST_TIMEOUT_MS = 5_000/);
});

test("student lesson revalidation stays authorized and race-safe", () => {
  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /signal: controller\.signal/);
  assert.match(client, /sequence !== epoch\.current/);
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /if \(!response\.ok\) throw Error\("Access denied"\)/);
  assert.match(client, /if \(!detail\.ok\) throw Error\("Lesson unavailable"\)/);
  assert.match(
    client,
    /if \(privatePanel\.current\) privatePanel\.current\.hidden = false/,
  );
  assert.doesNotMatch(client, /localStorage|sessionStorage|serviceWorker/);
});

test("UI mitigation does not replace existing server-authorized routes", () => {
  assert.match(page, /studentAccountLink: \{/);
  assert.match(page, /revocation: null/);
  assert.match(page, /if \(!eligible\) notFound\(\)/);
  assert.match(route, /readPupilReleasedLessons\(schoolId\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});

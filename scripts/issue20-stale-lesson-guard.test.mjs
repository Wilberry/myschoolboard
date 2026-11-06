import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const client = read("src/components/student-lessons-editor.tsx");
const page = read("app/schools/[schoolId]/my-lessons/page.tsx");
const route = read("app/api/schools/[schoolId]/student-lessons/route.ts");
const config = read("next.config.ts");

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
  assert.match(
    client,
    /if \(!detail\.ok\) throw Error\("Lesson unavailable"\)/,
  );
  assert.match(
    client,
    /if \(privatePanel\.current\) privatePanel\.current\.hidden = false/,
  );
  assert.doesNotMatch(client, /localStorage|sessionStorage|serviceWorker/);
});

test("initial revalidation defers state updates until its request completes", () => {
  assert.match(client, /const initialCheck = window\.setTimeout\(/);
  assert.match(client, /clearTimeout\(initialCheck\)/);
  assert.match(client, /void revalidate\(true\)/);
  assert.match(
    client,
    /if \(sequence === epoch\.current\) setWorking\(false\)/,
  );
});

test("print requires fresh lesson authorization and clears its temporary grant", () => {
  assert.match(client, /async function printLesson\(\)/);
  assert.match(client, /if \(!response\.ok\) throw Error\("Access denied"\)/);
  assert.match(client, /fresh\.revisionNumber !== lesson\.revisionNumber/);
  assert.match(client, /fresh\.content !== lesson\.content/);
  assert.match(client, /fresh\.objectives !== lesson\.objectives/);
  assert.match(client, /printGrantUntil\.current = grant/);
  assert.match(client, /window\.print\(\)/);
  assert.match(client, /"beforeprint", handleBeforePrint/);
  assert.match(client, /"afterprint", handleAfterPrint/);
  assert.match(
    client,
    /if \(printGrantUntil\.current <= Date\.now\(\)\) redact\(\)/,
  );
  assert.match(client, /printGrantUntil\.current = 0/);
  assert.match(client, /Print this lesson/);
});

test("UI mitigation does not replace existing server-authorized routes", () => {
  assert.match(page, /studentAccountLink: \{/);
  assert.match(page, /revocation: null/);
  assert.match(page, /if \(!eligible\) notFound\(\)/);
  assert.match(route, /readPupilReleasedLessons\(schoolId\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});

test("student lesson HTML and RSC segment prefetches opt out of HTTP caching", () => {
  assert.match(config, /async headers\(\)/);
  for (const path of [
    "/schools/:schoolId/my-lessons",
    "/schools/:schoolId/my-lessons.segments/:path*",
  ]) {
    assert.ok(config.includes(`source: "${path}"`));
  }
  assert.ok(
    config.includes("private, no-cache, no-store, max-age=0, must-revalidate"),
  );
  assert.match(config, /cacheComponents: true/);
  assert.match(config, /partialPrefetching: true/);
});

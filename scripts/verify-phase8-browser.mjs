import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";

// Deliberately opt-in and destructive only to this run's synthetic assignments,
// identity links and sessions. Never reactivate terminal revocations.
const fixturePath = process.env.PHASE8_BROWSER_FIXTURE_FILE;
assert.match(fixturePath ?? "", /^\/tmp\/phase8-[A-Za-z0-9_-]+\.json$/);
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.TEST_DATABASE_DISPOSABLE, "1");
const database = new URL(process.env.TEST_DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
assert.equal(database.port, "5434");
assert.equal(database.pathname, "/myschoolboard_test");
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.equal(new URL(base).protocol, "http:");
const f = JSON.parse(await readFile(fixturePath, "utf8"));
assert.match(f.schoolA, /^asm-school-a-/);
assert.match(f.pupilId, /^phase8-recipient-/);
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PHASE8_PLAYWRIGHT_MODULE ??
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core",
);
const axe = await readFile(
  process.env.PHASE8_AXE_PATH ??
    "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
  "utf8",
);
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();
const browser = await chromium.launch({
  executablePath: process.env.PHASE8_CHROMIUM ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
const contexts = [];
const observations = {
  browser: browser.version(),
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
};
async function check(id, fn) {
  try {
    const detail = await fn();
    results.push({ id, outcome: "PASS", ...(detail ? { detail } : {}) });
    console.log(id, "PASS");
  } catch (e) {
    results.push({
      id,
      outcome: "FAIL",
      reason: String(e.message).slice(0, 350),
    });
    console.log(id, "FAIL", String(e.message).split("\n")[0]);
  }
}
async function actor(name) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  contexts.push(context);
  const response = await context.request.post(
    `${base}/api/auth/sign-in/email`,
    {
      data: {
        email: `asm-${name}-${f.suffix}@example.test`,
        password: f.password,
      },
      headers: { origin: base },
    },
  );
  assert.equal(response.status(), 200, "synthetic sign-in must succeed");
  return context;
}
const teacher = await actor("teacher"),
  parent = await actor("browser-parent"),
  student = await actor("report-student"),
  admin = await actor("admin");
const teacherPage = await teacher.newPage(),
  parentPage = await parent.newPage(),
  studentPage = await student.newPage();
const preparation = `/schools/${f.schoolA}/result-preparation`,
  reports = `/schools/${f.schoolA}/reports`;
const query = new URLSearchParams({
  classId: f.classId,
  subjectId: f.subjectId,
  sessionId: f.sessionId,
  termId: f.termId,
});
const prepApi = `/api/schools/${f.schoolA}/result-preparation?${query}`;
const reportApi = `/api/schools/${f.schoolA}/published-reports`;
const marker = "CloudSynthetic";
async function loadPreparation(page = teacherPage) {
  await page.bringToFront();
  await page.goto(base + preparation);
  await page.locator("#result-prep-assignment").selectOption(f.assignmentId);
  await page.locator("#result-prep-term").selectOption(f.termId);
  await page
    .getByRole("button", { name: "Check result source readiness" })
    .click();
  await page.getByText(marker, { exact: false }).waitFor({ state: "visible" });
}
async function loadReports(page, context) {
  await page.bringToFront();
  await page.goto(base + reports);
  await page.getByRole("button", { name: "Recheck access" }).click();
  await page.getByText(marker, { exact: false }).waitFor({ state: "visible" });
  assert.equal((await context.request.get(base + reportApi)).status(), 200);
}
async function visibleMarker(page) {
  return page
    .getByText(marker, { exact: false })
    .isVisible()
    .catch(() => false);
}
async function pdfText(page, name) {
  const file = `/tmp/phase8-${name}.pdf`;
  await page.pdf({ path: file, format: "A4", printBackground: true });
  return execFileSync("pdftotext", [file, "-"], { encoding: "utf8" });
}
try {
  await check("P8-BR-01", async () => {
    const response = await teacher.request.get(base + prepApi);
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.preparation.status, "PRIVATE_PREPARATION_ONLY");
    assert.equal(body.preparation.studentCount, 2);
    assert.ok(body.preparation.students.some((p) => p.studentId === f.pupilId));
    assert.equal(JSON.stringify(body).includes("correctIndex"), false);
    await loadPreparation();
  });
  await check("P8-BR-02", async () => {
    for (const role of [
      "head",
      "principal",
      "admin",
      "super",
      "browser-parent",
      "report-student",
      "foreign",
    ]) {
      const c = await actor(role);
      const response = await c.request.get(base + prepApi);
      assert.equal(response.status(), 404);
      assert.equal((await response.text()).includes(marker), false);
      const html = await c.request.get(base + preparation);
      assert.equal((await html.text()).includes(marker), false);
    }
    const anonymous = await browser.newContext();
    contexts.push(anonymous);
    assert.equal((await anonymous.request.get(base + prepApi)).status(), 401);
  });
  await check("P8-BR-03", async () => {
    for (const field of ["classId", "subjectId", "sessionId", "termId"]) {
      const altered = new URLSearchParams(query);
      altered.set(field, "foreign-synthetic-id");
      const response = await teacher.request.get(
        `${base}/api/schools/${f.schoolA}/result-preparation?${altered}`,
      );
      assert.equal(response.status(), 404);
      assert.equal((await response.text()).includes(marker), false);
    }
    assert.equal(
      (
        await teacher.request.get(
          `${base}/api/schools/${f.schoolB}/result-preparation?${query}`,
        )
      ).status(),
      404,
    );
  });
  await check("P8-BR-04", async () => {
    const responses = [];
    for (const [route, headers] of [
      [preparation, {}],
      [preparation, { RSC: "1" }],
      [
        preparation + ".segments/_tree.segment.rsc",
        {
          RSC: "1",
          "Next-Router-Prefetch": "1",
          "Next-Router-Segment-Prefetch": "/_tree",
        },
      ],
    ]) {
      const response = await teacher.request.get(base + route, { headers });
      const cache = response.headers()["cache-control"];
      assert.ok(cache?.includes("no-store"));
      assert.ok(cache?.includes("private"));
      assert.equal((await response.text()).includes(marker), false);
      responses.push({
        status: response.status(),
        type: response.headers()["content-type"],
        cache,
      });
    }
    return responses;
  });
  await check("P8-BR-05", async () => {
    await loadPreparation();
    let release;
    let seen;
    const intercepted = new Promise((resolve) => (seen = resolve));
    const gate = new Promise((resolve) => (release = resolve));
    await teacherPage.route("**/result-preparation?**", async (route) => {
      const response = await route.fetch();
      seen();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    });
    await teacherPage
      .getByRole("button", { name: "Check result source readiness" })
      .click();
    await intercepted;
    await teacherPage.locator("#result-prep-assignment").selectOption("");
    release();
    await teacherPage.waitForTimeout(300);
    assert.equal(await visibleMarker(teacherPage), false);
    await teacherPage.unroute("**/result-preparation?**");
    await loadPreparation();
  });
  await check("P8-BR-06", async () => {
    await loadPreparation();
    const tab = await teacher.newPage();
    await tab.goto("about:blank");
    assert.equal(await visibleMarker(teacherPage), false);
    await teacherPage.bringToFront();
    await teacherPage
      .getByText(marker, { exact: false })
      .waitFor({ state: "visible" });
    await tab.close();
  });
  await check("P8-BR-09-preparation", async () => {
    await loadPreparation();
    const text = await pdfText(teacherPage, "preparation");
    assert.equal(text.includes(marker), false);
    assert.equal(text.includes("Synthetic Pupil"), false);
  });
  await check("P8-BR-13", async () => {
    await loadPreparation();
    await teacherPage.addScriptTag({ content: axe });
    const violations = await teacherPage.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact }));
    });
    assert.deepEqual(violations, []);
    await teacherPage.setViewportSize({ width: 375, height: 812 });
    assert.ok(
      await teacherPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await teacherPage.keyboard.press("Tab");
    assert.ok(
      await teacherPage.evaluate(
        () => document.activeElement !== document.body,
      ),
    );
    await teacherPage.setViewportSize({ width: 1280, height: 900 });
  });
  await check("P8-RECIPIENT-01", async () => {
    await loadReports(parentPage, parent);
    await loadReports(studentPage, student);
    const body = await (await parent.request.get(base + reportApi)).json();
    assert.equal(body.reports.length, 1);
    assert.equal(body.reports[0].studentId, f.pupilId);
    for (const key of [
      "rawPercentBps",
      "composedStudentCards",
      "studentSourceCards",
      "correctIndex",
    ])
      assert.equal(JSON.stringify(body).includes(key), false);
    const denied = await teacher.request.get(base + reportApi);
    assert.equal(denied.status(), 404);
    assert.equal(
      (
        await student.request.get(
          `${base}/api/schools/${f.schoolB}/published-reports`,
        )
      ).status(),
      404,
    );
  });
  await check("P8-RECIPIENT-02", async () => {
    await loadReports(studentPage, student);
    const response = await student.request.get(base + reports);
    assert.ok(response.headers()["cache-control"]?.includes("no-store"));
    await studentPage.addScriptTag({ content: axe });
    const violations = await studentPage.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return r.violations.map((v) => v.id);
    });
    assert.deepEqual(violations, []);
  });
  await check("P8-PRINT-01", async () => {
    await loadReports(parentPage, parent);
    await parentPage.evaluate(() => {
      window.print = () => {
        window.phase8PrintRequested = true;
      };
    });
    await parentPage
      .getByRole("button", { name: "Print reports", exact: true })
      .click();
    await parentPage.waitForFunction(
      () => window.phase8PrintRequested === true,
    );
    const text = await pdfText(parentPage, "published-report");
    assert.ok(text.includes(marker));
    assert.ok(text.includes("Official report"));
    assert.ok(text.includes("Score"));
    return "Native Chromium PDF after explicit fresh-access Print command (window.print intercepted to capture headless output).";
  });
  await check("P8-BR-07", async () => {
    await loadPreparation();
    const start = Date.now();
    const revoked = await admin.request.post(
      `${base}/api/schools/${f.schoolA}/teacher-assignments/${f.assignmentId}/revoke`,
      {
        data: {
          reason: "Synthetic cloud browser terminal assignment revocation",
        },
      },
    );
    assert.equal(revoked.status(), 200);
    const denial = await teacher.request.get(base + prepApi);
    assert.equal(denial.status(), 404);
    const denialMs = Date.now() - start;
    await teacherPage
      .getByText(marker, { exact: false })
      .waitFor({ state: "hidden", timeout: 20000 });
    return { denialMs, concealmentMs: Date.now() - start };
  });
  await check("P8-BR-10-and-11", async () => {
    const lifecycle = [];
    await teacherPage.exposeFunction("phase8Lifecycle", (event) =>
      lifecycle.push(event),
    );
    await teacherPage.evaluate(() => {
      addEventListener("pageshow", (e) =>
        window.phase8Lifecycle({ type: "pageshow", persisted: e.persisted }),
      );
      addEventListener("pagehide", (e) =>
        window.phase8Lifecycle({ type: "pagehide", persisted: e.persisted }),
      );
    });
    await teacherPage.goto(base + "/");
    await teacherPage.goBack();
    assert.equal(await visibleMarker(teacherPage), false);
    const duplicate = await teacher.newPage();
    await duplicate.goto(base + preparation);
    assert.equal(await visibleMarker(duplicate), false);
    await duplicate.close();
    observations.bfcache = lifecycle;
    return {
      lifecycle,
      restorationObserved: lifecycle.some(
        (e) => e.type === "pageshow" && e.persisted,
      ),
    };
  });
  await check("P8-BR-08-cross-tab", async () => {
    const c = await actor("browser-parent"),
      loaded = await c.newPage();
    await loadReports(loaded, c);
    const tab = await c.newPage();
    await tab.goto(base + "/");
    await tab.getByRole("button", { name: "Sign out", exact: true }).click();
    await tab
      .getByRole("button", { name: /Sign in/i })
      .waitFor({ state: "visible" });
    assert.equal((await c.request.get(base + reportApi)).status(), 401);
    assert.equal(await visibleMarker(loaded), false);
  });
  await check("P8-BR-08-same-tab", async () => {
    const c = await actor("report-student"),
      loaded = await c.newPage();
    await loadReports(loaded, c);
    await loaded.getByRole("button", { name: "Sign out", exact: true }).click();
    await loaded
      .getByText(marker, { exact: false })
      .waitFor({ state: "hidden" });
    assert.equal((await c.request.get(base + reportApi)).status(), 401);
  });
  await check("P8-RECIPIENT-REVOCATION", async () => {
    await loadReports(parentPage, parent);
    const link = (
      await db.query(
        'SELECT "id" FROM "GuardianStudentLink" WHERE "schoolId"=$1 AND "guardianMembershipId"=$2 AND "studentId"=$3',
        [f.schoolA, f.members["browser-parent"], f.pupilId],
      )
    ).rows[0];
    assert.ok(link);
    const start = Date.now();
    const revoked = await admin.request.post(
      `${base}/api/schools/${f.schoolA}/guardian-links/${link.id}/revoke`,
      {
        data: {
          reason: "Synthetic cloud browser terminal guardian revocation",
        },
      },
    );
    assert.equal(revoked.status(), 201);
    assert.equal(
      (await (await parent.request.get(base + reportApi)).json()).reports
        .length,
      0,
    );
    assert.equal(
      (await (await student.request.get(base + reportApi)).json()).reports
        .length,
      0,
    );
    await parentPage
      .getByText(marker, { exact: false })
      .waitFor({ state: "hidden", timeout: 20000 });
    const text = await pdfText(parentPage, "revoked-report");
    assert.equal(text.includes(marker), false);
    return { concealmentMs: Date.now() - start };
  });
} finally {
  observations.results = results;
  observations.bfcacheRestoration =
    "If persisted restoration was not observed, that conditional scenario remains not exercised; no-store and back/forward concealment remain mandatory.";
  await writeFile(
    "/tmp/phase8-browser-results.json",
    JSON.stringify(observations, null, 2),
    { mode: 0o600 },
  );
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
  await db.end();
}
if (results.some((r) => r.outcome === "FAIL")) process.exitCode = 1;

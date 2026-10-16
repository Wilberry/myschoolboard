import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";
import { inspectBrowserFixture } from "./phase8-browser-fixture-readiness.mjs";
import { assertDisposableCompose } from "./verify-phase8-checkpoint.mjs";

const modes = new Set(["STUDENT_ONLY", "GUARDIAN_ONLY", "GUARDIAN_FIRST_ACK"]);

/**
 * This runner never creates pupils, adopts school policy, releases reports,
 * revokes links or changes feature flags. Synthetic receipts require a
 * second explicit opt-in and remain visible in immutable test DB history.
 */
export function assertRecipientBrowserTarget(env) {
  assertLocalVerificationTarget(env);
  if (
    env.PHASE8_BROWSER_DISPOSABLE_ACK !== "I_CONFIRMED_LOCAL_TEST_DB" ||
    env.PHASE8_REPORT_RELEASE_ENABLED !== "true" ||
    env.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED !== "true"
  ) {
    throw new Error(
      "Browser acceptance requires explicit synthetic-only flags",
    );
  }
  const url = new URL(env.BETTER_AUTH_URL);
  if (
    url.protocol !== "http:" ||
    url.port !== "3000" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    new URL(env.TEST_DATABASE_URL).searchParams.get("schema") !== "public"
  ) {
    throw new Error(
      "Browser acceptance is restricted to the loopback test app",
    );
  }
  const schoolId = env.PHASE8_BROWSER_SCHOOL_ID;
  const childId = env.PHASE8_BROWSER_STUDENT_ID;
  for (const value of [schoolId, childId]) {
    if (!value || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      throw new Error("Provide exact synthetic school and child IDs");
    }
  }
  if (!modes.has(env.PHASE8_BROWSER_EXPECT_MODE)) {
    throw new Error("Specify the expected adopted recipient policy mode");
  }
  for (const role of ["PARENT", "STUDENT"]) {
    const email = env[`PHASE8_BROWSER_${role}_EMAIL`];
    const password = env[`PHASE8_BROWSER_${role}_PASSWORD`];
    if (!email?.endsWith(".test") || !password || password.length < 12) {
      throw new Error(
        "Recipient browser accounts must use synthetic .test credentials",
      );
    }
  }
  const entry = env.PHASE8_BROWSER_PLAYWRIGHT_ENTRY;
  if (
    !entry ||
    !isAbsolute(entry) ||
    !entry.endsWith("/playwright/index.mjs")
  ) {
    throw new Error("Point to a separately installed Playwright index.mjs");
  }
  if (
    env.PHASE8_BROWSER_ALLOW_RECEIPT_WRITE === "1" &&
    env.PHASE8_BROWSER_EXPECT_MODE !== "GUARDIAN_FIRST_ACK"
  ) {
    throw new Error(
      "Explicit receipt test applies only to guardian-first mode",
    );
  }
  return { origin: url, schoolId, childId, entry };
}

export function assertNoLeaks(rows, childId, role, mode, acknowledged) {
  assert.ok(Array.isArray(rows), "Expected a reports array");
  if (role === "STUDENT") {
    assert.equal(rows.length > 0, mode === "STUDENT_ONLY" ||
      (mode === "GUARDIAN_FIRST_ACK" && acknowledged));
  } else {
    assert.equal(rows.length > 0, mode !== "STUDENT_ONLY");
  }
  for (const row of rows) {
    assert.equal(row.studentId, childId, "Foreign child disclosed");
    assert.equal(row.recipientRole, role);
    assert.equal(row.policyMode, mode);
    for (const forbidden of [
      "studentSourceCards",
      "composedStudentCards",
      "correctIndex",
      "earnedPoints",
    ]) {
      assert.ok(!(forbidden in row), "Private academic source data leaked");
    }
  }
}

function assertPrivateHeaders(response) {
  const headers = response.headers();
  assert.ok(headers["cache-control"]?.includes("no-store"));
  assert.ok(headers["x-robots-tag"]?.includes("noindex"));
}

async function signIn(browser, origin, email, password) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  const page = await context.newPage();
  await page.goto(origin.href);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: /Good to see you/ }).waitFor();
  return { context, page };
}

async function readReport(page, origin, schoolId) {
  const target = new URL(
    `/api/schools/${encodeURIComponent(schoolId)}/published-reports`,
    origin,
  );
  const pending = page.waitForResponse((response) =>
    response.url() === target.href &&
    response.request().method() === "GET",
  );
  await page.goto(new URL(
    `/schools/${encodeURIComponent(schoolId)}/published-reports`,
    origin,
  ).href);
  await page
    .getByRole("heading", { name: "My officially released subjects" })
    .waitFor();
  const response = await pending;
  assert.equal(response.status(), 200, "Recipient GET denied");
  assertPrivateHeaders(response);
  const data = await response.json();
  assert.ok(Array.isArray(data.reports));
  return { page, rows: data.reports };
}

async function checkPrintLifecycle(page, origin, schoolId, childId, mode) {
  const button = page.getByRole("button", {
    name: "Print authorized subject report / Save as PDF",
  });
  await button.waitFor();
  assert.equal(await button.isDisabled(), false);
  await page.emulateMedia({ media: "print" });
  const hidden = await page.evaluate(() => {
    const root = document.querySelector(".published-report-workspace");
    const article = root?.querySelector("article");
    return (
      root?.getAttribute("data-print-authorized") === "false" &&
      article &&
      getComputedStyle(article).display === "none"
    );
  });
  assert.ok(hidden, "Ctrl+P must not expose a cached result");
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => {
    window.__phase8SyntheticPrint = null;
    window.print = () => {
      const workspace = document.querySelector(".published-report-workspace");
      window.__phase8SyntheticPrint = {
        authorized: workspace?.getAttribute("data-print-authorized") === "true",
        articles: workspace?.querySelectorAll("article").length ?? 0,
      };
      window.dispatchEvent(new Event("afterprint"));
      window.__phase8SyntheticPrint.clearedAfterprint =
        workspace?.getAttribute("data-print-authorized") === "false" &&
        !workspace.querySelector("article");
    };
  });
  // Subscribe before clicking: a reused cached report or a stale React
  // state snapshot must never count as a newly authorized print operation.
  const reportUrl = new URL(
    `/api/schools/${encodeURIComponent(schoolId)}/published-reports`,
    origin,
  ).href;
  const verification = page.waitForResponse(
    (response) =>
      response.url() === reportUrl &&
      response.request().method() === "GET",
  );
  await button.click();
  const freshResponse = await verification;
  assert.equal(freshResponse.status(), 200, "Fresh print authorization denied");
  assertPrivateHeaders(freshResponse);
  const body = await freshResponse.json();
  assert.ok(Array.isArray(body.reports));
  assert.ok(body.reports.length > 0, "Printing had no newly authorized grades");
  for (const row of body.reports) {
    assert.equal(row.studentId, childId, "Print disclosed an unrelated pupil");
    assert.equal(row.policyMode, mode);
  }
  await page.waitForFunction(() => window.__phase8SyntheticPrint !== null);
  const captured = await page.evaluate(() => window.__phase8SyntheticPrint);
  assert.equal(captured.authorized, true);
  assert.ok(captured.articles > 0);
  // Inspect synchronously in the synthetic afterprint callback before
  // a successful permission refresh may legitimately repopulate the page.
  assert.equal(captured.clearedAfterprint, true);
}

export async function runRecipientBrowserAcceptance(
  env = process.env,
  driver,
  database,
) {
  const { origin, schoolId, childId } = assertRecipientBrowserTarget(env);
  const fixture = await inspectBrowserFixture(database, schoolId, childId);
  assert.equal(
    fixture.browserFixtureReady,
    true,
    "Incomplete synthetic DB fixture",
  );
  assert.equal(fixture.currentPolicy, env.PHASE8_BROWSER_EXPECT_MODE);
  const browser = await driver.chromium.launch({
    headless: true,
    ...(env.PHASE8_BROWSER_CHROMIUM_PATH
      ? { executablePath: env.PHASE8_BROWSER_CHROMIUM_PATH }
      : {}),
  });
  const contexts = [];
  try {
    const users = {};
    for (const role of ["PARENT", "STUDENT"]) {
      users[role] = await signIn(
        browser,
        origin,
        env[`PHASE8_BROWSER_${role}_EMAIL`],
        env[`PHASE8_BROWSER_${role}_PASSWORD`],
      );
      contexts.push(users[role].context);
    }
    const parent = await readReport(users.PARENT.page, origin, schoolId);
    let student = await readReport(users.STUDENT.page, origin, schoolId);
    const mode = env.PHASE8_BROWSER_EXPECT_MODE;
    const acknowledged = env.PHASE8_BROWSER_EXPECT_ACKNOWLEDGED === "true";
    assertNoLeaks(parent.rows, childId, "PARENT", mode, acknowledged);
    assertNoLeaks(student.rows, childId, "STUDENT", mode, acknowledged);

    const selectedChild = await users.STUDENT.page.request.get(
      new URL(
        `/api/schools/${encodeURIComponent(schoolId)}/published-reports?studentId=untrusted`,
        origin,
      ).href,
    );
    assert.equal(selectedChild.status(), 400);
    assert.ok(selectedChild.headers()["cache-control"]?.includes("no-store"));

    if (env.PHASE8_BROWSER_FOREIGN_SCHOOL_ID) {
      const foreignId = env.PHASE8_BROWSER_FOREIGN_SCHOOL_ID;
      assert.match(foreignId, /^[A-Za-z0-9_-]{1,128}$/);
      assert.notEqual(foreignId, schoolId);
      const foreign = await users.STUDENT.page.request.get(
        new URL(
          `/api/schools/${encodeURIComponent(foreignId)}/published-reports`,
          origin,
        ).href,
      );
      assert.equal(foreign.status(), 404, "Foreign school exposed a report");
    }

    let receiptWritten = false;
    if (
      mode === "GUARDIAN_FIRST_ACK" &&
      !acknowledged &&
      env.PHASE8_BROWSER_ALLOW_RECEIPT_WRITE === "1"
    ) {
      const acknowledge = users.PARENT.page.getByRole("button", {
        name: "Acknowledge this published subject",
      });
      await acknowledge.first().click();
      await users.PARENT.page
        .getByText("Acknowledged", { exact: true })
        .first()
        .waitFor();
      student = await readReport(users.STUDENT.page, origin, schoolId);
      assertNoLeaks(student.rows, childId, "STUDENT", mode, true);
      receiptWritten = true;
    }

    const printPage = student.rows.length
      ? users.STUDENT.page
      : parent.rows.length
        ? users.PARENT.page
        : null;
    assert.ok(printPage, "Expected a verified linked synthetic recipient");
    // Verify focus clears an actually visible confidential table, not a
    // previously redacted page after the native print test has finished.
    await printPage.getByRole("table", {
      name: "Individually authorized subject grades",
    }).first().waitFor();
    const beforeRefetch = await printPage.evaluate(() => {
      const previousCount = document.querySelectorAll(
        ".published-report-workspace article",
      ).length;
      window.dispatchEvent(new Event("focus"));
      const afterCount = document.querySelectorAll(
        ".published-report-workspace article",
      ).length;
      return { previousCount, afterCount };
    });
    assert.ok(beforeRefetch.previousCount > 0, "No rows before focus");
    assert.equal(
      beforeRefetch.afterCount, 0,
      "Focus returned cached recipient grades",
    );
    await printPage.getByRole("table", {
      name: "Individually authorized subject grades",
    }).first().waitFor();
    await checkPrintLifecycle(printPage, origin, schoolId, childId, mode);
    return {
      browserChecks: "passed",
      mode,
      auditedReceiptWritten: receiptWritten,
    };
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await browser.close();
  }
}

/**
 * Before enabling synthetic recipient gates, verify the *running* Compose
 * configuration and PostgreSQL readiness. Docker context/port forwards must
 * still be checked by the local operator; this never provisions a database.
 */
export function assertBrowserComposeConfig(config) {
  assertDisposableCompose(config.services?.["postgres-test"]);
}

export function verifyBrowserDockerTarget() {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const commands = [
    ["compose", "--profile", "test", "config", "--format", "json"],
    [
      "compose",
      "--profile",
      "test",
      "exec",
      "-T",
      "postgres-test",
      "pg_isready",
      "-U",
      "myschoolboard",
      "-d",
      "myschoolboard_test",
    ],
  ];
  for (const [index, args] of commands.entries()) {
    const result = spawnSync("docker", args, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 10_000,
    });
    if (result.error || result.status !== 0 || result.signal) {
      throw new Error("Refusing browser test: disposable Docker is not ready");
    }
    if (index === 0) {
      let config;
      try {
        config = JSON.parse(result.stdout);
      } catch {
        throw new Error("Refusing browser test: invalid Docker configuration");
      }
      assertBrowserComposeConfig(config);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let db;
  try {
    const { entry } = assertRecipientBrowserTarget(process.env);
    verifyBrowserDockerTarget();
    const { PrismaClient } = await import("@prisma/client");
    const driver = await import(pathToFileURL(entry).href);
    db = new PrismaClient();
    const result = await runRecipientBrowserAcceptance(process.env, driver, db);
    console.info(JSON.stringify(result));
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Synthetic browser acceptance failed",
    );
    process.exitCode = 1;
  } finally {
    if (db) await db.$disconnect();
  }
}

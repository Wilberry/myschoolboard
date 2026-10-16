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
    assert.equal(
      rows.length > 0,
      mode === "STUDENT_ONLY" ||
        (mode === "GUARDIAN_FIRST_ACK" && acknowledged),
    );
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

/**
 * A pre-ack student must see no grades: that alone cannot prove the signed-in
 * student owns the separately inventoried link for the exact selected child.
 * Validate the real browser session before evaluating any expected empty GET.
 */
export function assertSyntheticSessionUser(payload, expectedEmail) {
  const user = payload?.user;
  assert.ok(
    typeof user?.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(user.id),
    "Synthetic session is missing a valid user ID",
  );
  assert.ok(
    typeof user.email === "string" &&
      user.email.toLowerCase() === expectedEmail.toLowerCase(),
    "Signed-in account does not match the selected synthetic identity",
  );
  return user.id;
}

export async function assertSignedInRecipientLink(
  database,
  schoolId,
  childId,
  role,
  userId,
) {
  assert.ok(
    role === "PARENT" || role === "STUDENT",
    "Unexpected recipient role",
  );
  const member = await database.membership.findFirst({
    where: {
      schoolId,
      userId,
      role,
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  assert.ok(
    member?.id,
    "Synthetic login has no active exact-school recipient membership",
  );
  const common = {
    schoolId,
    studentId: childId,
    revocation: null,
    student: {
      status: "ENROLLED",
      enrollments: { some: { schoolId, status: "ACTIVE" } },
    },
  };
  const link =
    role === "PARENT"
      ? await database.guardianStudentLink.findFirst({
          where: { ...common, guardianMembershipId: member.id },
          select: { id: true },
        })
      : await database.studentAccountLink.findFirst({
          where: { ...common, studentMembershipId: member.id },
          select: { id: true },
        });
  assert.ok(
    link?.id,
    "Signed-in synthetic recipient has no verified exact-child link",
  );
}

async function verifySignedInRecipient(
  page,
  origin,
  database,
  schoolId,
  childId,
  role,
  email,
) {
  const response = await page.request.get(
    new URL("/api/auth/get-session", origin).href,
    { headers: { "Cache-Control": "no-store" } },
  );
  assert.equal(response.status(), 200, "Synthetic session request denied");
  const userId = assertSyntheticSessionUser(await response.json(), email);
  await assertSignedInRecipientLink(database, schoolId, childId, role, userId);
}

/**
 * Receipt acceptance must prove the very same released subject changed from
 * unacknowledged to acknowledged. A different prior receipt is not evidence.
 */
export function assertExactGuardianReceipt(
  parentBefore,
  parentAfter,
  studentBefore,
  studentAfter,
  releaseId,
) {
  assert.ok(typeof releaseId === "string" && releaseId.length > 0);
  assert.ok(Array.isArray(parentBefore) && Array.isArray(parentAfter));
  assert.ok(Array.isArray(studentBefore) && Array.isArray(studentAfter));
  assert.ok(
    parentBefore.some(
      (row) =>
        row.releaseId === releaseId && row.guardianHasAcknowledged === false,
    ),
    "Selected release was not awaiting guardian receipt",
  );
  assert.ok(
    parentAfter.some(
      (row) =>
        row.releaseId === releaseId && row.guardianHasAcknowledged === true,
    ),
    "Fresh guardian GET did not confirm the exact receipt",
  );
  // Multiple subjects may already have separate acknowledged releases.
  // Require the exact newly acknowledged release to be the sole ADDITION;
  // never confuse it with an earlier authorized subject or permit duplicates.
  const uniqueReleaseIds = (rows) => {
    const ids = new Set();
    for (const row of rows) {
      assert.ok(
        typeof row?.releaseId === "string" && row.releaseId.length > 0,
        "Recipient report is missing a valid release ID",
      );
      assert.ok(!ids.has(row.releaseId), "Duplicate recipient release");
      ids.add(row.releaseId);
    }
    return ids;
  };
  const previouslyVisible = uniqueReleaseIds(studentBefore);
  const currentlyVisible = uniqueReleaseIds(studentAfter);
  assert.ok(
    !previouslyVisible.has(releaseId),
    "Selected subject was visible before its acknowledgment",
  );
  assert.equal(
    currentlyVisible.size,
    previouslyVisible.size + 1,
    "Acknowledgment must unlock exactly one additional subject",
  );
  assert.ok(
    currentlyVisible.has(releaseId),
    "Student did not receive the exact acknowledged release",
  );
  for (const existingReleaseId of previouslyVisible) {
    assert.ok(
      currentlyVisible.has(existingReleaseId),
      "A previously authorized subject changed during receipt acceptance",
    );
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
  const pending = page.waitForResponse(
    (response) =>
      response.url() === target.href && response.request().method() === "GET",
  );
  await page.goto(
    new URL(
      `/schools/${encodeURIComponent(schoolId)}/published-reports`,
      origin,
    ).href,
  );
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

async function checkRestoredPageLifecycle(page, origin, schoolId, childId) {
  const reportUrl = new URL(
    `/api/schools/${encodeURIComponent(schoolId)}/published-reports`,
    origin,
  ).href;
  const verifying = page.waitForResponse(
    (response) =>
      response.url() === reportUrl && response.request().method() === "GET",
  );
  const counts = await page.evaluate(() => {
    const root = document.querySelector(".published-report-workspace");
    const before = root?.querySelectorAll("article").length ?? 0;
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", {
        persisted: true,
      }),
    );
    const hidden = root?.querySelectorAll("article").length ?? 0;
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", {
        persisted: true,
      }),
    );
    return {
      before,
      hidden,
      printAllowed: root?.getAttribute("data-print-authorized"),
    };
  });
  assert.ok(counts.before > 0, "No grade rows before pagehide");
  assert.equal(counts.hidden, 0, "Pagehide retained sensitive grade rows");
  assert.equal(counts.printAllowed, "false");
  const checked = await verifying;
  assert.equal(checked.status(), 200, "Restored page was not reauthorized");
  assertPrivateHeaders(checked);
  const payload = await checked.json();
  assert.ok(Array.isArray(payload.reports));
  assert.ok(payload.reports.length > 0);
  for (const row of payload.reports) {
    assert.equal(row.studentId, childId);
  }
  await page
    .getByRole("table", {
      name: "Individually authorized subject grades",
    })
    .first()
    .waitFor();
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
      response.url() === reportUrl && response.request().method() === "GET",
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
      await verifySignedInRecipient(
        users[role].page,
        origin,
        database,
        schoolId,
        childId,
        role,
        env[`PHASE8_BROWSER_${role}_EMAIL`],
      );
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
      env.PHASE8_BROWSER_ALLOW_RECEIPT_WRITE === "1"
    ) {
      const acknowledgeButtons = users.PARENT.page.getByRole("button", {
        name: "Acknowledge this published subject",
      });
      const acknowledge = acknowledgeButtons.first();
      const selectedReleaseId = await acknowledge
        .locator("xpath=ancestor::tr[1]")
        .getAttribute("data-release-id");
      assert.ok(selectedReleaseId, "Receipt button has no exact release ID");
      const reportUrl = new URL(
        `/api/schools/${encodeURIComponent(schoolId)}/published-reports`,
        origin,
      ).href;
      const pendingFreshParent = users.PARENT.page.waitForResponse(
        (response) =>
          response.url() === reportUrl && response.request().method() === "GET",
      );
      await acknowledge.click();
      const freshParent = await pendingFreshParent;
      assert.equal(freshParent.status(), 200);
      assertPrivateHeaders(freshParent);
      const parentPayload = await freshParent.json();
      assertNoLeaks(
        parentPayload.reports,
        childId,
        "PARENT",
        mode,
        acknowledged,
      );
      await users.PARENT.page.waitForFunction(
        (id) =>
          [...document.querySelectorAll("tr[data-release-id]")].some(
            (row) =>
              row.getAttribute("data-release-id") === id &&
              row.textContent?.includes("Acknowledged"),
          ),
        selectedReleaseId,
      );
      const beforeStudent = student.rows;
      student = await readReport(users.STUDENT.page, origin, schoolId);
      assertNoLeaks(student.rows, childId, "STUDENT", mode, true);
      assertExactGuardianReceipt(
        parent.rows,
        parentPayload.reports,
        beforeStudent,
        student.rows,
        selectedReleaseId,
      );
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
    await printPage
      .getByRole("table", {
        name: "Individually authorized subject grades",
      })
      .first()
      .waitFor();
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
      beforeRefetch.afterCount,
      0,
      "Focus returned cached recipient grades",
    );
    await printPage
      .getByRole("table", {
        name: "Individually authorized subject grades",
      })
      .first()
      .waitFor();
    await checkRestoredPageLifecycle(printPage, origin, schoolId, childId);
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

export function assertLocalDockerHost(contextHost, configuredHost) {
  // A remote Docker daemon's "127.0.0.1" port mapping refers to its own
  // host, not this machine. Only local Unix sockets are permitted here.
  for (const value of [contextHost, configuredHost].filter(Boolean)) {
    if (
      !value.startsWith("unix:///") ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      throw new Error(
        "Refusing browser acceptance: Docker daemon is not a local Unix socket",
      );
    }
  }
  if (!contextHost) {
    throw new Error("Refusing browser acceptance: unknown Docker endpoint");
  }
}

export function verifyBrowserDockerTarget() {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const context = spawnSync(
    "docker",
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { cwd, encoding: "utf8", stdio: "pipe", timeout: 10_000 },
  );
  if (context.error || context.status !== 0 || context.signal) {
    throw new Error("Refusing browser acceptance: Docker context unavailable");
  }
  assertLocalDockerHost(context.stdout.trim(), process.env.DOCKER_HOST);
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

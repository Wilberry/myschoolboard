import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ??
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core",
);
const identity = JSON.parse(
  await readFile(process.env.PHASE10_DISPOSABLE_IDENTITY_FILE, "utf8"),
);
assert.equal(identity.phase, "phase10");
assert.equal(identity.root, process.cwd());
assert.equal(identity.port, 3001);
const docker = (args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const physical = JSON.parse(docker(["inspect", identity.id]))[0];
assert.equal(physical.Config.Labels["codex.task"], "phase10");
assert.deepEqual(physical.Mounts, []);
assert.ok(physical.HostConfig.Tmpfs["/var/lib/postgresql/data"]);
assert.ok(physical.State.Running);
assert.equal(
  JSON.parse(docker(["inspect", identity.runner]))[0].HostConfig.NetworkMode,
  "container:" + identity.id,
);
docker([
  "exec",
  identity.runner,
  "node",
  "scripts/verify-phase9-disposable.mjs",
  "--preflight",
]);
assert.match(
  process.env.PHASE10_REPORT_FIXTURE_FILE ?? "",
  /^\/tmp\/phase8-[\w-]+\.json$/,
);
assert.match(
  process.env.PHASE10_FINANCIAL_FIXTURE_FILE ?? "",
  /^\/tmp\/phase9-[\w-]+\.json$/,
);
const report = JSON.parse(
    await readFile(process.env.PHASE10_REPORT_FIXTURE_FILE, "utf8"),
  ),
  fee = JSON.parse(
    await readFile(process.env.PHASE10_FINANCIAL_FIXTURE_FILE, "utf8"),
  );
assert.match(report.schoolA, /^asm-school-a-/);
assert.match(fee.schoolA, /^p9-account-a-/);
assert.ok(process.env.DISPLAY);
const base = "http://localhost:3001",
  results = [],
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await mkdtemp("/tmp/phase10-family-chromium-");
const child = spawn(
  "/usr/bin/chromium",
  [
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let browser, failure;
async function check(name, fn) {
  await fn();
  results.push({ name, outcome: "PASS" });
  console.log(name, "PASS");
}
async function actor(prefix, fixture, name, native = false) {
  const context = native ? browser.contexts()[0] : await browser.newContext();
  let signed;
  for (let i = 0; i < 4; i++) {
    signed = await context.request.post(base + "/api/auth/sign-in/email", {
      data: {
        email: `${prefix}-${name}-${fixture.suffix}@example.test`,
        password: fixture.password,
      },
      headers: { origin: base },
    });
    if (signed.status() !== 429) break;
    await sleep(11000);
  }
  assert.equal(signed.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("dialog", (d) => d.accept());
  return { context, page };
}
async function api(a, school, path, body, method = body ? "post" : "get") {
  return a.context.request[method](base + `/api/schools/${school}` + path, {
    ...(body ? { data: body } : {}),
    headers: { origin: base },
  });
}
async function post(a, school, path, body) {
  const response = await api(a, school, path, body);
  assert.ok(
    [200, 201].includes(response.status()),
    `${path}: ${response.status()}`,
  );
  return response.json();
}
const intent = (values) => ({
  requestKey: randomUUID(),
  reason: "Synthetic authenticated family notification acceptance",
  ...values,
});
async function inbox(a, school) {
  const response = await api(a, school, "/module-notifications");
  assert.equal(response.status(), 200);
  return response.json();
}
async function drain(a, school) {
  for (let i = 0; i < 100; i++) {
    if (!(await post(a, school, "/module-delivery", {})).processed) return;
  }
  throw Error("Synthetic family queue exceeded bounded drain");
}
async function openInbox(a, school) {
  await a.page.bringToFront();
  await a.page.goto(`${base}/schools/${school}/inbox`);
  await a.page
    .getByRole("heading", { name: "In-app notifications", exact: true })
    .waitFor();
  await a.page
    .getByRole("region", { name: "School workflow updates", exact: true })
    .getByText("Current school communication records loaded.", { exact: true })
    .waitFor();
}
async function axe(a) {
  await a.page.addScriptTag({
    path:
      process.env.AXE_MODULE ??
      "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
  });
  const result = await a.page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  assert.deepEqual(
    result.violations.map((v) => v.id),
    [],
  );
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (await readFile(profile + "/DevToolsActivePort", "utf8")).split(
        "\n",
      )[0];
      break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(port);
  browser = await chromium.connectOverCDP("http://127.0.0.1:" + port, {
    noDefaults: true,
  });
  const reportOwner = await actor("asm", report, "super"),
    guardian = await actor("asm", report, "browser-parent", true),
    pupil = await actor("asm", report, "report-student");
  let publication;
  await check(
    "P10-FAMILY-BR-01 parent-first notification, explicit acknowledgment and pupil-only unlock",
    async () => {
      publication = (
        await post(reportOwner, report.schoolA, "/report-publications", {
          compositionId: report.pendingCompositionId,
          visibility: "PARENT_FIRST",
          reason:
            "Synthetic independently reviewed parent-first browser release",
        })
      ).events[0].id;
      await drain(reportOwner, report.schoolA);
      assert.equal(
        (await inbox(pupil, report.schoolA)).items.filter((item) =>
          item.href.endsWith("/reports"),
        ).length,
        0,
      );
      const alert = (await inbox(guardian, report.schoolA)).items.find((item) =>
        item.href.endsWith("/reports"),
      );
      assert.ok(alert);
      await openInbox(guardian, report.schoolA);
      const article = guardian.page.getByRole("article", {
        name: `Notification ${alert.id}`,
        exact: true,
      });
      const saved = guardian.page.waitForResponse(
        (r) =>
          r.url().endsWith(`/module-notifications/${alert.id}/state`) &&
          r.request().method() === "POST",
      );
      await article
        .getByRole("button", { name: "Mark read", exact: true })
        .click();
      assert.ok([200, 201].includes((await saved).status()));
      assert.equal(
        (await (await api(pupil, report.schoolA, "/published-reports")).json())
          .reports.length,
        0,
      );
      await openInbox(guardian, report.schoolA);
      await guardian.page
        .getByRole("article", { name: `Notification ${alert.id}`, exact: true })
        .getByRole("link", {
          name: "Open current school workflow",
          exact: true,
        })
        .click();
      await guardian.page.waitForURL(
        `${base}/schools/${report.schoolA}/reports`,
      );
      const ack = guardian.page.waitForResponse(
        (r) =>
          r.url().endsWith("/report-acknowledgments") &&
          r.request().method() === "POST",
      );
      await guardian.page
        .getByRole("button", { name: "Acknowledge this report", exact: true })
        .click();
      assert.equal((await ack).status(), 200);
      await drain(reportOwner, report.schoolA);
      assert.equal(
        (await inbox(pupil, report.schoolA)).items.filter((item) =>
          item.href.endsWith("/reports"),
        ).length,
        1,
      );
      assert.equal(
        (await (await api(pupil, report.schoolA, "/published-reports")).json())
          .reports.length,
        1,
      );
    },
  );
  await check(
    "P10-FAMILY-BR-02 native guardian tab/history, responsive accessibility and report withdrawal",
    async () => {
      await openInbox(guardian, report.schoolA);
      const other = await guardian.context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await guardian.page.waitForFunction(
        () => document.visibilityState === "hidden",
      );
      assert.equal(
        await guardian.page
          .getByRole("article", { name: /^Notification / })
          .first()
          .isVisible(),
        false,
      );
      await other.close();
      await guardian.page.bringToFront();
      await guardian.page
        .getByRole("region", { name: "School workflow updates", exact: true })
        .getByText("Current school communication records loaded.", {
          exact: true,
        })
        .waitFor();
      await guardian.page.goto(`${base}/schools/${report.schoolA}/reports`);
      await guardian.page.goBack();
      await guardian.page.waitForURL(`${base}/schools/${report.schoolA}/inbox`);
      for (const width of [375, 768, 1280]) {
        await guardian.page.setViewportSize({ width, height: 900 });
        await openInbox(guardian, report.schoolA);
        await axe(guardian);
        assert.ok(
          await guardian.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
      const withdrawn = await api(
        reportOwner,
        report.schoolA,
        "/report-publications",
        {
          publicationId: publication,
          reason: "Synthetic notification source withdrawal",
        },
        "delete",
      );
      assert.equal(withdrawn.status(), 201);
      assert.equal(
        (await inbox(pupil, report.schoolA)).items.filter((item) =>
          item.href.endsWith("/reports"),
        ).length,
        0,
      );
      assert.equal(
        (await (await api(pupil, report.schoolA, "/published-reports")).json())
          .reports.length,
        0,
      );
    },
  );
  const owner = await actor("p9", fee, "owner"),
    admin = await actor("p9", fee, "admin"),
    student = await actor("p9", fee, "browserstudent"),
    parent = await actor("p9", fee, "browserparent"),
    unrelated = await actor("p9", fee, "unrelated");
  await check(
    "P10-FAMILY-BR-03 pending evidence, independent review, guardian-only receipt and withdrawal",
    async () => {
      const obligation = (
        await post(
          owner,
          fee.schoolA,
          "/fee-obligations",
          intent({
            enrollmentId: fee.browserEnrollmentId,
            revisionId: fee.revisionId,
          }),
        )
      ).obligation;
      const reference = "P10-FAMILY-" + randomUUID().toUpperCase();
      const evidence = (
        await post(
          admin,
          fee.schoolA,
          "/payment-evidence",
          intent({
            obligationId: obligation.id,
            transferReference: reference,
            claimedAmountMinor: "4000",
          }),
        )
      ).evidence;
      await drain(owner, fee.schoolA);
      assert.equal(
        (await inbox(student, fee.schoolA)).items.filter((item) =>
          item.href.endsWith("/my-fees"),
        ).length,
        0,
      );
      assert.equal(
        (await api(parent, fee.schoolA, "/module-notifications")).status(),
        404,
      );
      const decision = (
        await post(owner, fee.schoolA, "/payment-verifications", {
          evidenceId: evidence.id,
          action: "VERIFIED",
          transferReference: reference,
          fundsConfirmed: true,
          reason: "Synthetic independent bank statement confirmation",
        })
      ).decision;
      const allocation = (
        await post(
          owner,
          fee.schoolA,
          "/manual-payment-allocations",
          intent({ verificationId: decision.id }),
        )
      ).allocation;
      await post(
        owner,
        fee.schoolA,
        "/fee-account-releases",
        intent({
          obligationId: obligation.id,
          action: "PUBLISHED",
          visibility: "GUARDIAN_ONLY",
        }),
      );
      const receipt = (
        await post(
          owner,
          fee.schoolA,
          "/fee-receipts",
          intent({ allocationId: allocation.id }),
        )
      ).receipt;
      await drain(owner, fee.schoolA);
      const alerts = (await inbox(parent, fee.schoolA)).items.filter((item) =>
        item.href.endsWith("/my-fees"),
      );
      assert.equal(alerts.length, 2);
      assert.equal(
        (await inbox(student, fee.schoolA)).items.filter((item) =>
          item.href.endsWith("/my-fees"),
        ).length,
        0,
      );
      assert.equal(
        (await api(unrelated, fee.schoolA, "/module-notifications")).status(),
        404,
      );
      assert.equal(
        (await api(pupil, fee.schoolA, "/module-notifications")).status(),
        404,
      );
      await openInbox(parent, fee.schoolA);
      await axe(parent);
      await parent.page
        .getByRole("article", {
          name: `Notification ${alerts[0].id}`,
          exact: true,
        })
        .getByRole("link", {
          name: "Open current school workflow",
          exact: true,
        })
        .click();
      await parent.page.waitForURL(`${base}/schools/${fee.schoolA}/my-fees`);
      await parent.page
        .getByRole("article", {
          name: `Receipt ${receipt.receiptNumber}`,
          exact: true,
        })
        .waitFor();
      const records = await (
        await api(parent, fee.schoolA, "/my-financial-records")
      ).json();
      assert.equal(
        records.accounts.find((row) => row.obligationId === obligation.id)
          .remainingMinor,
        "6000",
      );
      await post(
        owner,
        fee.schoolA,
        "/fee-account-releases",
        intent({
          obligationId: obligation.id,
          action: "WITHDRAWN",
          visibility: "STAFF_ONLY",
        }),
      );
      assert.equal(
        (await api(parent, fee.schoolA, "/module-notifications")).status(),
        404,
      );
      assert.equal(
        (await (await api(parent, fee.schoolA, "/my-financial-records")).json())
          .receipts.length,
        0,
      );
    },
  );
} catch (error) {
  failure = error;
  console.error(error);
} finally {
  if (process.env.PHASE10_BROWSER_RESULTS_FILE)
    await writeFile(
      process.env.PHASE10_BROWSER_RESULTS_FILE,
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          browser: "Authenticated native Chromium",
          checks: results,
          outcome: failure ? "FAIL" : "PASS",
          limitations: [
            "No persisted BFCache assertion",
            "Report/fee source setup uses authenticated browser-context API requests; new inbox/read and report acknowledgment use actual UI",
          ],
        },
        null,
        2,
      ) + "\n",
    );
  await browser?.close();
  child.kill("SIGTERM");
}
if (failure) process.exitCode = 1;

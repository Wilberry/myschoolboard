import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";
import sharp from "sharp";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";

// Opt-in acceptance runner: only new, independently attested, synthetic fixtures.
// Revocations are terminal; re-running requires a fresh fixture, never restoration.
verifyPhase9DatabaseIdentity(process.env);
const fixture = process.env.PHASE9_BROWSER_FIXTURE_FILE;
assert.match(fixture ?? "", /^\/tmp\/phase9-[A-Za-z0-9_-]+\.json$/);
const f = JSON.parse(await readFile(fixture, "utf8"));
assert.match(f.schoolA, /^p9-account-a-/);
const base = process.env.BETTER_AUTH_URL;
assert.equal(base, "http://localhost:3000");
const root = `/api/schools/${f.schoolA}`;
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const axe = await readFile(
  "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
  "utf8",
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();
const contexts = [],
  children = [],
  checks = [];
async function check(name, action) {
  await action();
  checks.push({ name, outcome: "PASS" });
  console.log(name, "PASS");
}
async function actor(name, native = false) {
  let context;
  if (native) {
    assert.ok(process.env.DISPLAY);
    const profile = await mkdtemp("/tmp/phase9-native-");
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
      { stdio: "ignore", detached: true },
    );
    children.push(child);
    let port;
    for (let i = 0; i < 100; i++) {
      try {
        port = (await readFile(`${profile}/DevToolsActivePort`, "utf8")).split(
          "\n",
        )[0];
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(port);
    const connected = await chromium.connectOverCDP(
      `http://127.0.0.1:${port}`,
      { noDefaults: true },
    );
    context = connected.contexts()[0];
  } else context = await browser.newContext();
  contexts.push(context);
  let signed;
  for (let attempt = 0; attempt < 3; attempt++) {
    signed = await context.request.post(`${base}/api/auth/sign-in/email`, {
      data: {
        email: `p9-${name}-${f.suffix}@example.test`,
        password: f.password,
      },
      headers: { origin: base },
    });
    if (signed.status() !== 429) break;
    const seconds = Math.min(
      30,
      Math.max(10, Number(signed.headers()["retry-after"]) || 10),
    );
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  assert.equal(signed.status(), 200);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  return { context, page };
}
async function current(page) {
  await page
    .getByText("Current school financial records loaded.", { exact: true })
    .waitFor();
}
async function open(person, recipient = false) {
  await person.page.bringToFront();
  await person.page.goto(
    `${base}/schools/${f.schoolA}/${recipient ? "my-fees" : "finance"}`,
  );
  await current(person.page);
}
async function refresh(page) {
  await page.bringToFront();
  const loaded = page.waitForResponse(
    (r) =>
      r.url().includes(root + "/") &&
      r.request().method() === "GET" &&
      /finance-workspace|my-financial-records/.test(r.url()),
  );
  await page
    .getByRole("button", { name: "Recheck access", exact: true })
    .click();
  await loaded;
  await current(page);
}
async function ui(page, title, endpoint, values = {}) {
  await refresh(page);
  const form = page.getByRole("form", { name: title, exact: true });
  // Fee configuration is intentionally collapsed until requested.
  if (!(await form.isVisible()))
    await page
      .getByText("Fee setup and student charges", { exact: true })
      .click();
  for (const [name, value] of Object.entries(values)) {
    const input = form.locator(`[name="${name}"]`);
    if ((await input.evaluate((e) => e.tagName)) === "SELECT")
      await input.selectOption(value);
    else if (typeof value === "boolean") await input.setChecked(value);
    else await input.fill(value);
  }
  await form
    .locator('[name="reason"]')
    .fill("Synthetic Phase 9 browser acceptance evidence");
  // Observe the actual upstream response before Chromium discards an unused
  // no-store mutation body; forward its bytes/status/headers unchanged.
  const target = base + root + "/" + endpoint;
  let observed;
  await page.route(target, async (route) => {
    const upstream = await route.fetch();
    observed = { status: upstream.status(), body: await upstream.json() };
    await route.fulfill({ response: upstream });
  });
  const done = page.waitForResponse(
    (r) => r.url() === target && r.request().method() === "POST",
  );
  await form.getByRole("button", { name: title, exact: true }).click();
  await done;
  await page.unroute(target);
  assert.ok(
    [200, 201].includes(observed.status),
    `${title}: ${observed.status}`,
  );
  console.log("UI", title, "HTTP", observed.status);
  const result = observed.body;
  await current(page);
  return result;
}
async function api(person, path) {
  return person.context.request.get(base + root + path);
}
async function account(person, id) {
  const response = await api(person, `/fee-accounts?obligationId=${id}`);
  assert.equal(response.status(), 200);
  return (await response.json()).accounts[0];
}
async function pdf(page, label) {
  const path = `/tmp/phase9-${label}.pdf`;
  await page.pdf({ path, format: "A4", printBackground: true });
  return execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
}
let owner, admin, student, parent, obligation, claim, allocation, receipt;
try {
  owner = await actor("owner");
  admin = await actor("admin");
  student = await actor("browserstudent");
  parent = await actor("browserparent", true);
  await check("P9-BROWSER-ISSUE", async () => {
    await open(owner);
    obligation = (
      await ui(owner.page, "Issue student charge", "fee-obligations", {
        enrollmentId: f.browserEnrollmentId,
        revisionId: f.revisionId,
      })
    ).obligation;
    assert.ok(obligation.id);
    await open(student, true);
    assert.equal(
      (await (await api(student, "/my-financial-records")).json()).accounts
        .length,
      0,
    );
    await open(admin);
    claim = (
      await ui(admin.page, "Submit payment reference", "payment-evidence", {
        obligationId: obligation.id,
        transferReference: `BROWSER-${f.suffix.toUpperCase()}`,
        amount: "40.00",
      })
    ).evidence;
    assert.ok(claim.id);
    assert.equal((await account(owner, obligation.id)).remainingMinor, "10000");
  });
  await check("P9-BROWSER-PRIVATE-IMAGE", async () => {
    await refresh(admin.page);
    const form = admin.page.getByRole("form", {
      name: "Attach payment evidence image",
    });
    await form.locator('[name="evidenceId"]').selectOption(claim.id);
    const buffer = await sharp({
      create: { width: 64, height: 32, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await form.locator('[name="file"]').setInputFiles({
      name: "synthetic-blank.png",
      mimeType: "image/png",
      buffer,
    });
    let uploaded;
    const uploadUrl = base + root + "/payment-evidence-attachments";
    await admin.page.route(uploadUrl, async (route) => {
      const response = await route.fetch();
      uploaded = { status: response.status(), body: await response.json() };
      await route.fulfill({ response });
    });
    const done = admin.page.waitForResponse(
      (r) =>
        r.url() === base + root + "/payment-evidence-attachments" &&
        r.request().method() === "POST",
    );
    done.catch(() => {});
    await form
      .getByRole("button", {
        name: "Attach payment evidence image",
        exact: true,
      })
      .click();
    const result = await done;
    assert.equal(result.status(), 201);
    await admin.page.unroute(uploadUrl);
    const attachment = uploaded.body.attachment;
    assert.ok(attachment.id);
    const image = await api(
      owner,
      `/payment-evidence-attachments/${attachment.id}`,
    );
    assert.equal(image.status(), 200);
    assert.equal(image.headers()["content-type"], "image/png");
    assert.match(image.headers()["cache-control"], /no-store/);
    assert.equal(
      (
        await api(student, `/payment-evidence-attachments/${attachment.id}`)
      ).status(),
      404,
    );
    assert.equal((await account(owner, obligation.id)).remainingMinor, "10000");
  });
  await check("P9-BROWSER-REVIEW-RECEIPT", async () => {
    const reviewed = await ui(
      owner.page,
      "Verify bank reference",
      "payment-verifications",
      {
        evidenceId: claim.id,
        transferReference: `BROWSER-${f.suffix.toUpperCase()}`,
        confirmed: true,
      },
    );
    allocation = (
      await ui(
        owner.page,
        "Allocate reviewed payment",
        "manual-payment-allocations",
        { verificationId: reviewed.decision.id },
      )
    ).allocation;
    receipt = (
      await ui(owner.page, "Approve receipt", "fee-receipts", {
        allocationId: allocation.id,
      })
    ).receipt;
    assert.ok(receipt.id);
    assert.equal((await account(owner, obligation.id)).remainingMinor, "6000");
    await ui(owner.page, "Publish financial account", "fee-account-releases", {
      obligationId: obligation.id,
      visibility: "STUDENT_AND_GUARDIAN",
    });
    await open(student, true);
    await open(parent, true);
    assert.equal((await account(parent, obligation.id)).remainingMinor, "6000");
    await parent.page
      .getByRole("article", { name: `Receipt ${receipt.receiptNumber}` })
      .waitFor();
  });
  await check("P9-BROWSER-WAIVER-REPORT", async () => {
    const proposed = (
      await ui(
        admin.page,
        "Propose fee adjustment",
        "fee-adjustment-proposals",
        { obligationId: obligation.id, kind: "WAIVER", amount: "10.00" },
      )
    ).proposal;
    const reviewed = (
      await ui(
        owner.page,
        "Review fee adjustment",
        "fee-adjustment-decisions",
        { proposalId: proposed.id, action: "APPROVED" },
      )
    ).decision;
    assert.equal((await account(owner, obligation.id)).remainingMinor, "6000");
    await ui(owner.page, "Apply approved waiver", "fee-waiver-applications", {
      decisionId: reviewed.id,
    });
    assert.equal((await account(parent, obligation.id)).remainingMinor, "5000");
    const csv = await api(owner, "/finance-reports?format=csv");
    assert.equal(csv.status(), 200);
    assert.match(csv.headers()["content-type"], /text\/csv/);
    assert.ok((await csv.text()).includes("NGN"));
    assert.equal(
      (await api(admin, "/finance-reports?format=csv")).status(),
      404,
    );
  });
  await check("P9-BROWSER-ACCESSIBILITY", async () => {
    await open(student, true);
    await student.page.setViewportSize({ width: 375, height: 850 });
    assert.ok(
      await student.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await student.page.addScriptTag({ content: axe });
    const violations = await student.page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({ id: v.id, impact: v.impact })),
    );
    assert.deepEqual(violations, []);
    await student.page.keyboard.press("Tab");
    assert.ok(
      await student.page.evaluate(
        () => document.activeElement !== document.body,
      ),
    );
    await open(owner);
    await owner.page.addScriptTag({ content: axe });
    assert.deepEqual(
      await owner.page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => v.id),
      ),
      [],
    );
  });
  await check("P9-BROWSER-NATIVE-PRIVACY", async () => {
    await open(parent, true);
    const page = parent.page;
    const other = await parent.context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    assert.equal(await page.evaluate(() => document.hasFocus()), false);
    assert.equal(
      await page
        .getByRole("table", { name: "Current school accounting balances" })
        .isVisible(),
      false,
    );
    await page.bringToFront();
    await current(page);
    await page.getByRole("table").waitFor();
    await page.evaluate(() => {
      window.print = () => {
        window.__printed = true;
        window.dispatchEvent(new Event("beforeprint"));
      };
    });
    await page
      .getByRole("button", { name: "Print records", exact: true })
      .click();
    await page.waitForFunction(() => window.__printed === true);
    // Headful page.pdf works via Chromium's printToPDF protocol.
    const text = await pdf(page, "approved-receipt");
    assert.ok(text.includes(receipt.receiptNumber));
    assert.ok(text.includes("Browser"));
    assert.ok(text.includes("50.00"));
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.equal(await page.getByRole("table").isVisible(), false);
    assert.equal(
      (await pdf(page, "without-permit")).includes(receipt.receiptNumber),
      false,
    );
  });
  await check("P9-BROWSER-REVERSAL", async () => {
    const request = (
      await ui(
        admin.page,
        "Request allocation reversal",
        "manual-allocation-reversals",
        { allocationId: allocation.id },
      )
    ).reversal;
    await ui(
      owner.page,
      "Review allocation reversal",
      "manual-allocation-reversal-decisions",
      { requestId: request.id, action: "APPROVED" },
    );
    assert.equal((await account(parent, obligation.id)).remainingMinor, "9000");
    await open(parent, true);
    await parent.page
      .getByText("Reversed allocation — excluded from the current balance.", {
        exact: true,
      })
      .waitFor();
  });
  await check("P9-BROWSER-WITHDRAWAL", async () => {
    await ui(owner.page, "Withdraw financial account", "fee-account-releases", {
      obligationId: obligation.id,
    });
    await refresh(student.page);
    assert.equal(
      (await (await api(student, "/my-financial-records")).json()).accounts
        .length,
      0,
    );
    assert.equal(await student.page.getByRole("article").count(), 0);
    await ui(owner.page, "Publish financial account", "fee-account-releases", {
      obligationId: obligation.id,
      visibility: "STUDENT_AND_GUARDIAN",
    });
  });
  await check("P9-BROWSER-LATE-RESPONSE-SIGNOUT", async () => {
    await open(student, true);
    const sibling = await student.context.newPage();
    await sibling.goto(`${base}/schools/${f.schoolA}/my-fees`);
    await current(sibling);
    await student.page.bringToFront();
    let resolve, intercepted;
    const ready = new Promise((r) => (intercepted = r)),
      release = new Promise((r) => (resolve = r));
    await student.page.route(
      `**${root}/my-financial-records`,
      async (route) => {
        const response = await route.fetch();
        intercepted();
        await release;
        await route.fulfill({ response });
      },
    );
    await student.page
      .getByRole("button", { name: "Recheck access", exact: true })
      .click();
    await ready;
    const signedOut = sibling.waitForResponse(
      (r) => r.url() === base + "/api/auth/sign-out",
    );
    await sibling
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    assert.equal((await signedOut).status(), 200);
    resolve();
    await student.page.waitForTimeout(11000);
    assert.equal(await student.page.getByRole("table").count(), 0);
    await student.page.unroute(`**${root}/my-financial-records`);
    assert.equal((await api(student, "/my-financial-records")).status(), 401);
    await sibling.close();
  });
  await check("P9-BROWSER-TERMINAL-REVOCATION", async () => {
    await open(parent, true);
    const link = (
      await db.query(
        'SELECT "id" FROM "GuardianStudentLink" WHERE "schoolId"=$1 AND "guardianMembershipId"=$2 AND "studentId"=$3',
        [f.schoolA, f.members.browserparent, f.browserPupilId],
      )
    ).rows[0];
    assert.ok(link);
    const revoke = await admin.context.request.post(
      `${base}/api/schools/${f.schoolA}/guardian-links/${link.id}/revoke`,
      {
        data: {
          reason: "Synthetic terminal finance browser guardian revocation",
        },
      },
    );
    assert.equal(revoke.status(), 201);
    assert.equal(
      (await (await api(parent, "/my-financial-records")).json()).accounts
        .length,
      0,
    );
    await parent.page
      .getByRole("table")
      .waitFor({ state: "hidden", timeout: 20000 });
    assert.equal(
      (await pdf(parent.page, "revoked")).includes(receipt.receiptNumber),
      false,
    );
  });
  await check("P9-BROWSER-MEMBERSHIP-REVOCATION", async () => {
    await open(owner);
    const changed = await db.query(
      'UPDATE "Membership" SET "isActive"=false WHERE "id"=$1 AND "schoolId"=$2 AND "userId"=$3 AND "isActive"=true',
      [f.members.owner, f.schoolA, f.actors.owner],
    );
    assert.equal(changed.rowCount, 1);
    assert.equal((await api(owner, "/finance-workspace")).status(), 404);
    assert.equal(
      (await api(owner, "/finance-reports?format=csv")).status(),
      404,
    );
    await owner.page
      .getByRole("table")
      .first()
      .waitFor({ state: "hidden", timeout: 20000 });
    assert.equal(
      (await pdf(owner.page, "owner-revoked")).includes(receipt.receiptNumber),
      false,
    );
  });
} catch (error) {
  console.error("Acceptance failed:", error.message);
  for (const [name, person] of Object.entries({
    owner,
    admin,
    student,
    parent,
  })) {
    if (person)
      await person.page
        .screenshot({ path: `/tmp/phase9-failure-${name}.png` })
        .catch(() => {});
  }
  throw error;
} finally {
  await writeFile(
    "/tmp/phase9-browser-results.json",
    JSON.stringify(
      {
        checks,
        completed: checks.length,
        source: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
  for (const child of children)
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  await db.end();
}

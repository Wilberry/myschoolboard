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
function docker(args) {
  return execFileSync(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
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
const fixturePath = process.env.PHASE10_BROWSER_FIXTURE_FILE;
assert.match(fixturePath ?? "", /^\/tmp\/phase10-[\w-]+\.json$/);
const f = JSON.parse(await readFile(fixturePath, "utf8"));
assert.match(f.school, /^p10-notices-/);
const base = "http://localhost:3001",
  root = `/api/schools/${f.school}`,
  url = `${base}/schools/${f.school}/notices`;
assert.equal(identity.port, 3001);
assert.ok(process.env.DISPLAY);
const profile = await mkdtemp("/tmp/phase10-chromium-");
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
let browser;
const results = [];
let failure;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 220; i++) {
    if (await fn()) return;
    await sleep(100);
  }
  throw Error("Timed out waiting for browser assertion");
}
async function check(name, fn) {
  await fn();
  results.push({ name, outcome: "PASS" });
  console.log(name, "PASS");
}
async function actor(name) {
  const context =
    name === "browserstudent"
      ? browser.contexts()[0]
      : await browser.newContext();
  let response;
  for (let i = 0; i < 3; i++) {
    response = await context.request.post(base + "/api/auth/sign-in/email", {
      data: {
        email: `p10-${name}-${f.tag}@example.test`,
        password: f.password,
      },
      headers: { origin: base },
    });
    if (response.status() !== 429) break;
    await sleep(11000);
  }
  assert.equal(response.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("dialog", (d) => d.accept());
  return { context, page };
}
async function current(p) {
  try {
    await p
      .getByText("Current school communication records loaded.", {
        exact: true,
      })
      .first()
      .waitFor();
  } catch (e) {
    console.error(
      "Page state",
      await p.evaluate(() => ({
        focus: document.hasFocus(),
        visible: document.visibilityState,
        statuses: [...document.querySelectorAll("[role=status]")].map(
          (x) => x.textContent,
        ),
      })),
    );
    throw e;
  }
}
async function open(a, path = url) {
  await a.page.bringToFront();
  await a.page.goto(path);
  await current(a.page);
}
async function refresh(a) {
  await a.page.bringToFront();
  await a.page
    .getByRole("button", { name: "Recheck access", exact: true })
    .click();
  await current(a.page);
}
async function form(a, title, values = {}, notice) {
  await refresh(a);
  let scope = a.page;
  if (notice)
    scope = scope.getByRole("article", {
      name: `Managed notice ${notice}`,
      exact: true,
    });
  const el = scope.getByRole("form", { name: title, exact: true });
  for (const [key, value] of Object.entries({
    ...values,
    reason: "Synthetic authenticated browser acceptance",
  })) {
    const input = el.locator(`[name="${key}"]`);
    if (await input.count()) {
      if ((await input.evaluate((e) => e.tagName)) === "SELECT")
        await input.selectOption(value);
      else await input.fill(value);
    }
  }
  // Capture the body before the private workspace refresh discards the request.
  let observed;
  const pattern = base + root + "/**";
  await a.page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    observed = { status: response.status(), data: await response.json() };
    await route.fulfill({ response });
  });
  const done = a.page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().startsWith(base + root),
  );
  await el.getByRole("button", { name: title, exact: true }).click();
  await done;
  await a.page.unroute(pattern);
  assert.ok(
    observed && [200, 201].includes(observed.status),
    `Mutation failed: ${title} ${observed?.status}`,
  );
  await current(a.page);
  return observed.data.result;
}
async function api(a, path, body) {
  return a.context.request[body ? "post" : "get"](
    base + root + path,
    body ? { data: body, headers: { origin: base } } : {},
  );
}
const intent = (extra = {}) => ({
  reason: "Synthetic browser isolation",
  requestKey: randomUUID(),
  ...extra,
});
async function feed(a) {
  const r = await api(a, "/my-notices");
  assert.equal(r.status(), 200);
  return (await r.json()).notices;
}
async function publishForAudience(owner, audience, title) {
  const policy = await api(owner, "/notice-policies", intent({ audience }));
  assert.equal(policy.status(), 201);
  const created = await api(
    owner,
    "/notices",
    intent({ title, body: "Synthetic browser audience body" }),
  );
  assert.equal(created.status(), 201);
  const n = (await created.json()).result.id;
  for (const action of ["SUBMIT", "APPROVE"])
    assert.equal(
      (
        await api(
          owner,
          `/notices/${n}/decision`,
          intent({ action, expectedRevision: 1 }),
        )
      ).status(),
      201,
    );
  const released = await api(
    owner,
    `/notices/${n}/publish`,
    intent({ expectedRevision: 1, policyId: (await policy.json()).result.id }),
  );
  assert.equal(released.status(), 201);
  return (await released.json()).result.id;
}
try {
  let port;
  for (let i = 0; i < 220; i++) {
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
  const admin = await actor("admin"),
    owner = await actor("owner"),
    student = await actor("browserstudent"),
    parent = await actor("browserparent"),
    foreign = await actor("foreign");
  let notice, policy, release;
  const title = "Browser approved official notice " + randomUUID(),
    body = "Synthetic school notice body for browser acceptance.";
  await check(
    "P10-BR-01 administrator author, owner independent return/review/publication",
    async () => {
      await open(admin);
      assert.equal(
        await admin.page
          .getByRole("form", {
            name: "Create notice visibility policy",
            exact: true,
          })
          .count(),
        0,
      );
      notice = (await form(admin, "Create school notice", { title, body })).id;
      await form(admin, "Submit notice for review", {}, notice);
      assert.equal(
        (
          await api(
            admin,
            `/notices/${notice}/decision`,
            intent({ action: "APPROVE", expectedRevision: 1 }),
          )
        ).status(),
        404,
      );
      await open(owner);
      await form(owner, "Return notice revision", {}, notice);
      await form(
        admin,
        "Revise school notice",
        { title, body: body + " Revised." },
        notice,
      );
      await form(admin, "Submit notice for review", {}, notice);
      await form(owner, "Approve notice revision", {}, notice);
      policy = (
        await form(owner, "Create notice visibility policy", {
          audience: "STUDENTS_AND_GUARDIANS",
        })
      ).id;
      assert.equal(
        (
          await api(
            admin,
            `/notices/${notice}/publish`,
            intent({ expectedRevision: 2, policyId: policy }),
          )
        ).status(),
        404,
      );
      release = (
        await form(
          owner,
          "Publish reviewed notice",
          { policyId: policy },
          notice,
        )
      ).id;
    },
  );
  await check(
    "P10-BR-02 verified recipients, audience and cross-school isolation",
    async () => {
      for (const a of [student, parent]) {
        await open(a);
        assert.ok((await feed(a)).some((n) => n.id === release));
        assert.equal(
          await a.page
            .getByRole("form", { name: "Create school notice", exact: true })
            .count(),
          0,
        );
      }
      assert.equal(
        (await api(foreign, `/my-notices?releaseId=${release}`)).status(),
        404,
      );
      const denied = await foreign.context.request.get(url);
      assert.ok(!(await denied.text()).includes(title));
      const staffPolicy = await api(
        owner,
        "/notice-policies",
        intent({ audience: "STAFF_ONLY" }),
      );
      assert.equal(staffPolicy.status(), 201);
      const n = await api(
        owner,
        "/notices",
        intent({ title: "Synthetic staff only browser notice", body }),
      );
      const nid = (await n.json()).result.id;
      for (const action of ["SUBMIT", "APPROVE"])
        assert.equal(
          (
            await api(
              owner,
              `/notices/${nid}/decision`,
              intent({ action, expectedRevision: 1 }),
            )
          ).status(),
          201,
        );
      const r = await api(
        owner,
        `/notices/${nid}/publish`,
        intent({
          expectedRevision: 1,
          policyId: (await staffPolicy.json()).result.id,
        }),
      );
      assert.equal(r.status(), 201);
      const id = (await r.json()).result.id;
      for (const a of [student, parent])
        assert.equal(
          (await api(a, `/my-notices?releaseId=${id}`)).status(),
          404,
        );
    },
  );
  await check(
    "P10-BR-03 in-app delivery deduplication, explicit read/unread and deep link",
    async () => {
      for (let i = 0; i < 8; i++)
        assert.equal((await api(owner, "/notice-delivery", {})).status(), 200);
      const inbox = await api(student, "/notifications");
      assert.equal(inbox.status(), 200);
      const items = (await inbox.json()).items.filter((n) =>
        n.href.endsWith(release),
      );
      assert.equal(items.length, 1);
      assert.ok(!JSON.stringify(items).includes(title));
      await refresh(student);
      const card = student.page.getByRole("article", {
        name: `Notification ${items[0].id}`,
        exact: true,
      });
      const read = card.getByRole("form", { name: "Mark read", exact: true });
      const done = student.page.waitForResponse(
        (r) => r.url().endsWith("/state") && r.request().method() === "POST",
      );
      await read.getByRole("button").click();
      assert.equal((await done).status(), 201);
      await card
        .getByRole("form", { name: "Mark unread", exact: true })
        .waitFor();
      const undo = student.page.waitForResponse(
        (r) => r.url().endsWith("/state") && r.request().method() === "POST",
      );
      await card
        .getByRole("form", { name: "Mark unread", exact: true })
        .getByRole("button")
        .click();
      assert.equal((await undo).status(), 201);
      await card
        .getByRole("form", { name: "Mark read", exact: true })
        .waitFor();
      await card.getByRole("link", { name: "Open school notice" }).click();
      await student.page.waitForURL(url + "/" + release);
      await current(student.page);
      assert.ok(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
    },
  );
  await check(
    "P10-BR-10 versioned student-only and guardian-only audiences",
    async () => {
      const studentOnly = await publishForAudience(
        owner,
        "STUDENTS_ONLY",
        "Synthetic student-only browser notice",
      );
      assert.equal(
        (await api(student, `/my-notices?releaseId=${studentOnly}`)).status(),
        200,
      );
      assert.equal(
        (await api(parent, `/my-notices?releaseId=${studentOnly}`)).status(),
        404,
      );
      const parentOnly = await publishForAudience(
        owner,
        "GUARDIANS_ONLY",
        "Synthetic guardian-only browser notice",
      );
      assert.equal(
        (await api(parent, `/my-notices?releaseId=${parentOnly}`)).status(),
        200,
      );
      assert.equal(
        (await api(student, `/my-notices?releaseId=${parentOnly}`)).status(),
        404,
      );
      for (let i = 0; i < 8; i++)
        assert.equal((await api(owner, "/notice-delivery", {})).status(), 200);
    },
  );
  await check(
    "P10-BR-11 audited dead-letter replay and idempotent recovery",
    async () => {
      const id = await publishForAudience(
        owner,
        "STUDENTS_AND_GUARDIANS",
        "Synthetic browser retry notice",
      );
      docker([
        "exec",
        identity.runner,
        "node",
        "--import",
        "tsx",
        "scripts/phase10-browser-disposable-control.mjs",
        fixturePath,
        "stage-delivery-failures",
        id,
      ]);
      await form(owner, "Retry failed school alert");
      for (let i = 0; i < 8; i++)
        assert.equal((await api(owner, "/notice-delivery", {})).status(), 200);
      const items = (
        await (await api(student, "/notifications")).json()
      ).items.filter((x) => x.href.endsWith(id));
      assert.equal(items.length, 1);
    },
  );
  await check(
    "P10-BR-04 Back/Forward and native hidden tab conceal/recheck",
    async () => {
      await student.page.goBack();
      await student.page.bringToFront();
      await current(student.page);
      console.log("Back checked");
      await student.page.goForward();
      await student.page.bringToFront();
      await current(student.page);
      console.log("Forward checked");
      const other = await student.context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await until(
        async () =>
          !(await student.page
            .getByRole("heading", { name: title, exact: true })
            .isVisible()),
      );
      assert.equal(
        await student.page.evaluate(() => document.visibilityState),
        "hidden",
      );
      await student.page.bringToFront();
      await current(student.page);
      assert.ok(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
      await other.close();
    },
  );
  await check(
    "P10-BR-05 delayed response cannot redisclose after tab concealment",
    async () => {
      let releaseResponse, observed;
      const waiting = new Promise((r) => (releaseResponse = r));
      const caught = new Promise((r) => (observed = r));
      const pattern = base + root + "/my-notices?releaseId=" + release;
      await student.page.route(pattern, async (route) => {
        const response = await route.fetch();
        observed();
        await waiting;
        await route.fulfill({ response });
      });
      await student.page
        .getByRole("button", { name: "Recheck access", exact: true })
        .click();
      await caught;
      const other = await student.context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      releaseResponse();
      await sleep(300);
      assert.equal(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
        false,
      );
      await student.page.unroute(pattern);
      await student.page.bringToFront();
      await current(student.page);
      await other.close();
    },
  );
  await check("P10-BR-06 responsive keyboard and axe WCAG A/AA", async () => {
    const axe = await readFile(
      process.env.AXE_SCRIPT ??
        "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
      "utf8",
    );
    for (const width of [375, 768, 1280]) {
      await student.page.setViewportSize({ width, height: 900 });
      assert.ok(
        await student.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await student.page.keyboard.press("Tab");
    assert.ok(
      await student.page.evaluate(
        () => document.activeElement !== document.body,
      ),
    );
    await student.page.addScriptTag({ content: axe });
    const result = await student.page.evaluate(() =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
    );
    assert.deepEqual(
      result.violations.map((v) => ({ id: v.id, impact: v.impact })),
      [],
    );
  });
  await check(
    "P10-BR-12 private HTML and guarded native PDF printing",
    async () => {
      await open(student, url + "/" + release);
      const html = await student.context.request.get(url + "/" + release);
      assert.match(html.headers()["cache-control"], /private.*no-store/);
      assert.ok(!(await html.text()).includes(title));
      const directory = await mkdtemp("/tmp/phase10-print-");
      await student.page.pdf({ path: directory + "/ordinary.pdf" });
      assert.ok(
        !execFileSync("pdftotext", [directory + "/ordinary.pdf", "-"], {
          encoding: "utf8",
        }).includes(title),
      );
      await refresh(student);
      let captured = false;
      await student.page.exposeFunction("capturePhase10Print", async () => {
        await student.page.pdf({ path: directory + "/approved.pdf" });
        captured = true;
      });
      await student.page.evaluate(() => {
        window.print = () => {
          void window
            .capturePhase10Print()
            .then(() => window.dispatchEvent(new Event("afterprint")));
        };
      });
      await student.page
        .getByRole("button", { name: "Print released notices", exact: true })
        .click();
      await until(async () => captured);
      assert.ok(
        execFileSync("pdftotext", [directory + "/approved.pdf", "-"], {
          encoding: "utf8",
        }).includes(title),
      );
      await refresh(student);
    },
  );
  await check(
    "P10-BR-07 withdrawal removes feed/inbox and denies historical deep link",
    async () => {
      await form(owner, "Withdraw school notice", {}, notice);
      assert.equal(
        (await api(student, `/my-notices?releaseId=${release}`)).status(),
        404,
      );
      assert.ok(
        !(await (await api(student, "/notifications")).json()).items.some((n) =>
          n.href.endsWith(release),
        ),
      );
      await student.page.bringToFront();
      await student.page
        .getByRole("button", { name: "Recheck access", exact: true })
        .click();
      await student.page
        .getByText(
          "Communication records unavailable. Your access or the school’s visibility policy may have changed.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
        false,
      );
    },
  );
  await check(
    "P10-BR-09 actual membership and enrollment revocation conceal foreground records",
    async () => {
      const extra = await publishForAudience(
        owner,
        "STUDENTS_AND_GUARDIANS",
        "Synthetic revocation browser notice",
      );
      const marker = "Synthetic revocation browser notice";
      await open(student, url + "/" + extra);
      assert.ok(
        await student.page
          .getByRole("heading", { name: marker, exact: true })
          .isVisible(),
      );
      docker([
        "exec",
        identity.runner,
        "node",
        "scripts/phase10-browser-disposable-control.mjs",
        fixturePath,
        "revoke-student-membership",
      ]);
      await until(
        async () =>
          !(await student.page
            .getByRole("heading", { name: marker, exact: true })
            .isVisible()),
      );
      assert.equal(
        (await api(student, `/my-notices?releaseId=${extra}`)).status(),
        404,
      );
      await open(parent);
      assert.ok(
        await parent.page
          .getByRole("heading", { name: marker, exact: true })
          .isVisible(),
      );
      docker([
        "exec",
        identity.runner,
        "node",
        "scripts/phase10-browser-disposable-control.mjs",
        fixturePath,
        "end-pupil-enrollment",
      ]);
      await parent.page
        .getByRole("button", { name: "Recheck access", exact: true })
        .click();
      await parent.page
        .getByText(
          "Communication records unavailable. Your access or the school’s visibility policy may have changed.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        (await api(parent, `/my-notices?releaseId=${extra}`)).status(),
        404,
      );
      assert.equal(
        await parent.page
          .getByRole("heading", { name: marker, exact: true })
          .isVisible(),
        false,
      );
    },
  );
  await check(
    "P10-BR-08 actual cross-tab sign-out conceals and session denies",
    async () => {
      await open(admin);
      const second = await admin.context.newPage();
      await second.goto(url);
      await current(second);
      assert.ok(
        await second
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
      await admin.page.bringToFront();
      await admin.page
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await until(
        async () => (await api(admin, "/notifications")).status() === 401,
      );
      assert.equal(
        await second
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
        false,
      );
    },
  );
} catch (e) {
  failure = e;
  console.error(e instanceof Error ? e.stack : "Browser acceptance failed");
} finally {
  const report = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    sourceWorkingTreeDirty: !!execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim(),
    outcome: failure ? "FAIL" : "PASS",
    nativeChromium: true,
    checks: results,
    limitations: [
      "Genuine persisted BFCache restoration is not asserted.",
      "Retry/lease/concurrent crash recovery and terminal revocations have separate PostgreSQL integration coverage; full browser counterparts remain gates.",
    ],
  };
  const path =
    process.env.PHASE10_BROWSER_RESULT_FILE ??
    "/tmp/phase10-browser-result.json";
  await writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600 });
  await browser?.close();
  child.kill("SIGTERM");
  if (failure) process.exitCode = 1;
}

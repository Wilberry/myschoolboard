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
  process.env.PHASE10_BROWSER_FIXTURE_FILE ?? "",
  /^\/tmp\/phase10-security-[\w-]+\.json$/,
);
const f = JSON.parse(
  await readFile(process.env.PHASE10_BROWSER_FIXTURE_FILE, "utf8"),
);
assert.match(f.school, /^p10-security-browser-/);
assert.ok(process.env.DISPLAY);
const base = "http://localhost:3001";
const profile = await mkdtemp("/tmp/phase10-security-chromium-");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let browser, failure;
async function check(name, fn) {
  await fn();
  results.push({ name, outcome: "PASS" });
  console.log(name, "PASS");
}
async function actor(name, native = false) {
  const context = native ? browser.contexts()[0] : await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.bringToFront();
  await page.goto(base);
  await page.getByLabel("Email address", { exact: true }).fill(f.emails[name]);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/sign-in/email") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  if (name === "owner") {
    await page
      .getByRole("link", { name: "Account security", exact: true })
      .click();
    await page.waitForURL(base + "/account/security");
  }
  return { context, page };
}
async function opened(a, path = "/account/security") {
  await a.page.bringToFront();
  await a.page.goto(base + path);
  await a.page
    .getByText("Current account security records loaded.", { exact: true })
    .waitFor();
}
async function api(a, path = "/api/account/security-evidence") {
  return a.context.request.get(base + path);
}
async function axe(a) {
  await a.page.addScriptTag({
    path:
      process.env.AXE_CORE_SCRIPT ??
      "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
  });
  const violations = await a.page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((v) => ({ id: v.id, impact: v.impact })),
  );
  assert.deepEqual(violations, []);
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
  const owner = await actor("owner", true),
    operator = await actor("operator"),
    foreign = await actor("foreign");
  await check(
    "P10-SECURITY-BR-01 real UI authentication, private self evidence and school-owner global denial",
    async () => {
      await opened(owner);
      assert.ok(await owner.page.getByRole("article").count());
      const response = await api(owner);
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["cache-control"], "private, no-store");
      const body = await response.json();
      assert.ok(body.evidence.every((e) => e.subjectUserId === f.users.owner));
      assert.equal(
        (await api(owner, "/api/platform/security-evidence")).status(),
        404,
      );
      const other = await (await api(foreign)).json();
      assert.ok(
        other.evidence.every((e) => e.subjectUserId === f.users.foreign),
      );
      assert.ok(!other.evidence.some((e) => e.subjectUserId === f.users.owner));
      assert.equal(
        (
          await api(
            owner,
            "/api/account/security-evidence?userId=" + f.users.foreign,
          )
        ).status(),
        400,
      );
    },
  );
  await check(
    "P10-SECURITY-BR-02 native hidden tab, Back/Forward, responsive axe and private printing",
    async () => {
      const blank = await owner.context.newPage();
      await blank.goto("about:blank");
      await blank.bringToFront();
      await owner.page.waitForFunction(
        () => document.visibilityState === "hidden",
      );
      assert.equal(
        await owner.page.getByRole("article").filter({ visible: true }).count(),
        0,
      );
      await blank.close();
      await opened(owner);
      await owner.page.goto(base);
      await owner.page.goBack();
      await owner.page
        .getByText("Current account security records loaded.", { exact: true })
        .waitFor();
      await owner.page.goForward();
      await owner.page.goBack();
      await owner.page
        .getByText("Current account security records loaded.", { exact: true })
        .waitFor();
      for (const width of [375, 768, 1280]) {
        await owner.page.setViewportSize({ width, height: 900 });
        await owner.page
          .getByRole("button", { name: "Recheck access", exact: true })
          .click();
        await owner.page
          .getByText("Current account security records loaded.", {
            exact: true,
          })
          .waitFor();
        assert.ok(
          await owner.page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        await axe(owner);
      }
      await owner.page
        .getByRole("link", { name: "MySchoolBoard", exact: true })
        .focus();
      await owner.page.keyboard.press("Tab");
      assert.equal(
        await owner.page.evaluate(() =>
          document.activeElement?.textContent?.trim(),
        ),
        "Sign out",
      );
      const pdf = await owner.page.pdf({ printBackground: true });
      const file = profile + "/private-security-print.pdf";
      await writeFile(file, pdf, { mode: 0o600 });
      const text = execFileSync("pdftotext", [file, "-"], { encoding: "utf8" });
      assert.ok(!text.includes("Sign-in succeeded"));
      assert.ok(!text.includes("Session started"));
    },
  );
  let workerFile;
  if (process.env.PHASE10_SECURITY_INBOX_ACCEPTANCE === "1") {
    await check(
      "P10-SECURITY-BR-05 account/platform delivery, actual read/unread, deep links and authenticated CLI",
      async () => {
        const current = await (await api(owner)).json();
        const source = current.evidence.find(
          (e) => e.kind === "AUTH_SUCCEEDED",
        );
        assert.ok(source);
        const dispatch = async (eventId) =>
          operator.context.request.post(
            base + "/api/platform/security-delivery",
            { headers: { origin: base }, data: { eventId } },
          );
        assert.equal((await dispatch(source.id)).status(), 200);
        const repeated = await dispatch(source.id);
        assert.equal(repeated.status(), 200);
        assert.equal((await repeated.json()).processed, false);
        const ownResponse = await api(
          owner,
          "/api/account/security-notifications",
        );
        assert.equal(ownResponse.status(), 200);
        const own = await ownResponse.json();
        assert.equal(own.items.length, 1);
        assert.equal(own.items[0].href, "/account/security");
        assert.ok(!JSON.stringify(own).includes(f.emails.owner));
        assert.ok(!JSON.stringify(own).includes(f.users.owner));
        await opened(owner);
        const region = owner.page.getByRole("region", {
          name: "Account security notifications",
          exact: true,
        });
        await region
          .getByText("Current security notifications loaded.", { exact: true })
          .waitFor();
        const article = region.getByRole("article", {
          name: `Security notification ${own.items[0].id}`,
          exact: true,
        });
        for (const [label, read] of [
          ["Mark read", true],
          ["Mark unread", false],
        ]) {
          const response = owner.page.waitForResponse(
            (r) =>
              r.request().method() === "POST" &&
              r.url().endsWith(own.items[0].id + "/state"),
          );
          await article
            .getByRole("button", { name: label, exact: true })
            .click();
          assert.equal((await response).status(), 201);
          assert.equal(
            (
              await (
                await api(owner, "/api/account/security-notifications")
              ).json()
            ).items.find((i) => i.id === own.items[0].id).read,
            read,
          );
        }
        await article
          .getByRole("link", {
            name: "Open current security records",
            exact: true,
          })
          .click();
        await owner.page.waitForURL(base + "/account/security");
        let unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          unknown = await foreign.context.request.post(
            base + "/api/auth/sign-in/email",
            {
              headers: { origin: base },
              data: {
                email: `unknown-${randomUUID()}@example.test`,
                password: f.password,
              },
            },
          );
          if (unknown.status() !== 429) break;
          const seconds = Number(unknown.headers()["retry-after"] ?? "11");
          assert.ok(
            Number.isFinite(seconds) && seconds >= 0 && seconds < 60,
            "Bounded server retry window required",
          );
          await sleep(Math.max(1, seconds + 1) * 1000);
        }
        assert.equal(unknown.status(), 401);
        const global = await (
          await api(operator, "/api/platform/security-evidence")
        ).json();
        const failed = global.evidence.find(
          (e) => e.kind === "AUTH_FAILED" && e.subjectUserId === null,
        );
        assert.ok(failed);
        assert.equal((await dispatch(failed.id)).status(), 200);
        const alerts = await (
          await api(operator, "/api/platform/security-notifications")
        ).json();
        assert.ok(alerts.items.length);
        assert.ok(alerts.items.every((i) => i.href === "/platform/security"));
        assert.equal(
          (await api(owner, "/api/platform/security-notifications")).status(),
          404,
        );
        const personal = await (
          await api(operator, "/api/account/security-notifications")
        ).json();
        assert.ok(
          !personal.items.some((i) => alerts.items.some((a) => a.id === i.id)),
        );
        await opened(operator, "/platform/security");
        await operator.page
          .getByRole("region", {
            name: "Platform security notifications",
            exact: true,
          })
          .getByText("Current security notifications loaded.", { exact: true })
          .waitFor();
        await axe(operator);
        workerFile = `/tmp/phase10-security-worker-${randomUUID()}.json`;
        const cookie = (await operator.context.cookies())
          .map((c) => c.name + "=" + c.value)
          .join("; ");
        await writeFile(
          workerFile,
          JSON.stringify({ cookie, userId: f.users.operator }),
          { mode: 0o600, flag: "wx" },
        );
        docker(["cp", workerFile, identity.runner + ":" + workerFile]);
        docker([
          "exec",
          identity.runner,
          "node",
          "--import",
          "tsx",
          "scripts/verify-phase10-security-worker-session.ts",
          workerFile,
          "--allowed",
        ]);
      },
    );
  }
  await check(
    "P10-SECURITY-BR-03 platform metadata UI and still-signed-in current role revocation",
    async () => {
      await opened(operator, "/platform/security");
      await axe(operator);
      assert.equal(
        (await api(operator, "/api/platform/security-evidence")).status(),
        200,
      );
      docker([
        "exec",
        identity.runner,
        "node",
        "--import",
        "tsx",
        "scripts/prepare-phase10-security-browser.ts",
        "--revoke",
        process.env.PHASE10_BROWSER_FIXTURE_FILE,
      ]);
      assert.equal(
        (await api(operator, "/api/platform/security-evidence")).status(),
        404,
      );
      await operator.page
        .getByRole("button", { name: "Recheck access", exact: true })
        .click();
      await operator.page
        .getByText(
          "Account security records unavailable. Recheck your current access.",
          { exact: true },
        )
        .waitFor();
      await operator.page.waitForFunction(() =>
        [...document.querySelectorAll("article")].every(
          (el) => !el.checkVisibility(),
        ),
      );
      assert.equal(
        await operator.page
          .getByRole("article")
          .filter({ visible: true })
          .count(),
        0,
      );
      if (workerFile) {
        assert.equal(
          (
            await api(operator, "/api/platform/security-notifications")
          ).status(),
          404,
        );
        docker([
          "exec",
          identity.runner,
          "node",
          "--import",
          "tsx",
          "scripts/verify-phase10-security-worker-session.ts",
          workerFile,
          "--denied",
        ]);
      }
      assert.equal((await api(operator)).status(), 200);
    },
  );
  await check(
    "P10-SECURITY-BR-04 delayed private response, cross-tab sign-out and old-cookie replay denial",
    async () => {
      await opened(owner);
      const before = (await owner.context.cookies())
        .map((c) => c.name + "=" + c.value)
        .join("; ");
      let release, captured;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const ready = new Promise((resolve) => {
        captured = resolve;
      });
      await owner.page.route(
        "**/api/account/security-evidence",
        async (route) => {
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          captured();
          await gate;
          try {
            await route.fulfill({ response });
          } catch {
            /* The private hook may already have aborted this obsolete request. */
          }
        },
      );
      await owner.page
        .getByRole("button", { name: "Recheck access", exact: true })
        .click();
      await ready;
      const other = await owner.context.newPage();
      await other.goto(base + "/account/security");
      await other.bringToFront();
      const signedOut = other.waitForResponse(
        (r) =>
          r.url().endsWith("/api/auth/sign-out") &&
          r.request().method() === "POST",
      );
      await other
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      assert.equal((await signedOut).status(), 200);
      release();
      await owner.page.bringToFront();
      await sleep(400);
      assert.equal(
        await owner.page.getByRole("article").filter({ visible: true }).count(),
        0,
      );
      assert.equal((await api(owner)).status(), 401);
      const replay = await foreign.context.request.get(
        base + "/api/account/security-evidence",
        { headers: { cookie: before } },
      );
      assert.equal(replay.status(), 401);
      await owner.page.unroute("**/api/account/security-evidence");
      await other.close();
    },
  );
} catch (e) {
  failure = e;
  console.error(e);
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
            "Other source adapters and cumulative phase acceptance remain separate checks",
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

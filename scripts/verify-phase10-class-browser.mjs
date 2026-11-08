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
assert.match(f.school, /^p10-class-/);
const base = "http://localhost:3001",
  root = `/api/schools/${f.school}`,
  url = `${base}/schools/${f.school}/class-announcements`;
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
    name === "student" ? browser.contexts()[0] : await browser.newContext();
  let response;
  for (let i = 0; i < 3; i++) {
    response = await context.request.post(base + "/api/auth/sign-in/email", {
      data: {
        email: `p10-class-${name}-${f.tag}@example.test`,
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
        href: location.href,
        headings: [...document.querySelectorAll("h1")].map(
          (x) => x.textContent,
        ),
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
      name: `Managed class announcement ${notice}`,
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
  const teacher = await actor("teacher"),
    reviewer = await actor("reviewer"),
    student = await actor("student"),
    parent = await actor("parent"),
    owner = await actor("owner"),
    foreign = await actor("foreign"),
    formTeacher = await actor("form");
  const title = "Synthetic class browser announcement " + randomUUID();
  let announcement, release;
  await check(
    "P10-CLASS-BR-01 exact subject author, section review and original author release",
    async () => {
      await open(teacher);
      const titleLabel = await teacher.page
        .getByRole("form", { name: /^Create class announcement:/ })
        .first()
        .getAttribute("aria-label");
      announcement = (
        await form(teacher, titleLabel, {
          title,
          body: "Synthetic private class announcement body",
        })
      ).id;
      await form(teacher, "Submit class announcement", {}, announcement);
      assert.equal(
        (
          await api(
            teacher,
            `/class-announcements/${announcement}/decision`,
            intent({ action: "APPROVE", expectedRevision: 1 }),
          )
        ).status(),
        404,
      );
      await open(reviewer);
      await form(reviewer, "Approve class announcement", {}, announcement);
      release = (
        await form(teacher, "Release class announcement", {}, announcement)
      ).id;
    },
  );
  await check(
    "P10-CLASS-BR-02 parent denial on content, management, inbox, foreign-school denial",
    async () => {
      for (const endpoint of [
        "/my-class-announcements",
        "/class-announcement-workspace",
        "/class-notifications",
      ]) {
        assert.equal((await api(parent, endpoint)).status(), 404);
        assert.equal((await api(foreign, endpoint)).status(), 404);
      }
      assert.equal(
        (
          await api(parent, `/my-class-announcements?releaseId=${release}`)
        ).status(),
        404,
      );
      await open(owner);
      assert.equal(
        await owner.page
          .getByRole("heading", { name: title, exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    "P10-CLASS-BR-03 class-only notification, explicit read and secure deep link",
    async () => {
      for (let i = 0; i < 5; i++)
        assert.equal((await api(owner, "/class-delivery", {})).status(), 200);
      await open(student);
      assert.ok(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
      const items = (
        await (await api(student, "/class-notifications")).json()
      ).items.filter((x) => x.href.endsWith(release));
      assert.equal(items.length, 1);
      const card = student.page.getByRole("article", {
        name: `Notification ${items[0].id}`,
        exact: true,
      });
      const done = student.page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/state"),
      );
      await card
        .getByRole("button", { name: "Mark read", exact: true })
        .click();
      assert.equal((await done).status(), 201);
      await card
        .getByRole("button", { name: "Mark unread", exact: true })
        .waitFor();
      const deep = student.page.waitForResponse(
        (r) =>
          r.url() ===
          base + root + "/my-class-announcements?releaseId=" + release,
      );
      deep.catch(() => {});
      await card.getByRole("link", { name: "Open class announcement" }).click();
      await student.page.waitForURL(url + "?releaseId=" + release);
      assert.equal((await deep).status(), 200);
      await current(student.page);
    },
  );
  await check(
    "P10-CLASS-BR-04 native focus, Back/Forward and accessible responsive recipient",
    async () => {
      await student.page.goBack();
      await student.page.waitForURL(url);
      await current(student.page);
      console.log("Class Back passed");
      await student.page.goForward();
      await student.page.waitForURL(url + "?releaseId=" + release);
      await current(student.page);
      console.log("Class Forward passed");
      const blank = await student.context.newPage();
      await blank.goto("about:blank");
      await blank.bringToFront();
      await until(
        async () =>
          !(await student.page
            .getByRole("heading", { name: title, exact: true })
            .isVisible()),
      );
      assert.equal(
        await student.page.evaluate(() => document.hasFocus()),
        false,
      );
      await student.page.bringToFront();
      await current(student.page);
      await blank.close();
      for (const width of [375, 768, 1280]) {
        await student.page.setViewportSize({ width, height: 900 });
        assert.ok(
          await student.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
      const axe = await readFile(
        process.env.AXE_SCRIPT ??
          "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
        "utf8",
      );
      await student.page.addScriptTag({ content: axe });
      const scan = await student.page.evaluate(() =>
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        }),
      );
      assert.deepEqual(
        scan.violations.map((v) => v.id),
        [],
      );
    },
  );
  await check(
    "P10-CLASS-BR-05 actual Form Teacher responsibility and independent review",
    async () => {
      await open(formTeacher);
      const label = await formTeacher.page
        .getByRole("form", { name: /^Create class announcement:/ })
        .first()
        .getAttribute("aria-label");
      const n = (
        await form(formTeacher, label, {
          title: "Synthetic Form Teacher browser announcement",
          body: "Synthetic class-only form message",
        })
      ).id;
      await form(formTeacher, "Submit class announcement", {}, n);
      await form(reviewer, "Approve class announcement", {}, n);
      const r = (await form(formTeacher, "Release class announcement", {}, n))
        .id;
      assert.equal(
        (await api(student, `/my-class-announcements?releaseId=${r}`)).status(),
        200,
      );
      assert.equal(
        (await api(parent, `/my-class-announcements?releaseId=${r}`)).status(),
        404,
      );
    },
  );
  await check(
    "P10-CLASS-BR-06 author withdrawal denies source and inbox without exposing history",
    async () => {
      await form(teacher, "Withdraw class announcement", {}, announcement);
      assert.equal(
        (
          await api(student, `/my-class-announcements?releaseId=${release}`)
        ).status(),
        404,
      );
      assert.ok(
        !(await (await api(student, "/class-notifications")).json()).items.some(
          (i) => i.href.endsWith(release),
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
} catch (e) {
  failure = e;
  console.error(
    e instanceof Error ? e.stack : "Class browser acceptance failed",
  );
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
    limitations: ["Genuine persisted BFCache is not asserted."],
  };
  await writeFile(
    process.env.PHASE10_BROWSER_RESULT_FILE ??
      "/tmp/phase10-class-browser-result.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  await browser?.close();
  child.kill("SIGTERM");
  if (failure) process.exitCode = 1;
}

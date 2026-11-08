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
  /^\/tmp\/phase10-learning-[\w-]+\.json$/,
);
const f = JSON.parse(
  await readFile(process.env.PHASE10_BROWSER_FIXTURE_FILE, "utf8"),
);
assert.match(f.school, /^p10-tasks-/);
assert.ok(process.env.DISPLAY);
const base = "http://localhost:3001",
  root = `/api/schools/${f.school}`,
  url = `${base}/schools/${f.school}/learning-assignments`;
const profile = await mkdtemp("/tmp/phase10-learning-chromium-");
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
async function actor(name) {
  const context =
    name === "student" ? browser.contexts()[0] : await browser.newContext();
  let signed;
  for (let attempt = 0; attempt < 4; attempt++) {
    signed = await context.request.post(base + "/api/auth/sign-in/email", {
      data: {
        email: f.emails?.[name] ?? `p10-task-${name}-${f.tag}@example.test`,
        password: f.password,
      },
      headers: { origin: base },
    });
    if (signed.status() !== 429) break;
    await sleep(11000);
  }
  assert.ok(signed);
  assert.equal(signed.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("dialog", (d) => d.accept());
  return { context, page };
}
async function current(a) {
  await a.page
    .getByText("Current school communication records loaded.", { exact: true })
    .first()
    .waitFor();
}
async function open(a, path = url) {
  await a.page.bringToFront();
  await a.page.goto(path);
  await current(a);
}
async function refresh(a) {
  await a.page.bringToFront();
  await a.page
    .getByRole("button", { name: "Recheck access", exact: true })
    .click();
  await current(a);
}
async function api(a, path, body) {
  return a.context.request[body ? "post" : "get"](base + root + path, {
    ...(body ? { data: body } : {}),
    headers: { origin: base },
  });
}
async function form(a, title, values = {}, article) {
  await refresh(a);
  const scope = article
    ? a.page.getByRole("article", { name: article, exact: true })
    : a.page;
  const el = scope.getByRole("form", { name: title, exact: true });
  await el.waitFor();
  for (const [name, value] of Object.entries({
    ...values,
    reason: "Synthetic authenticated learning acceptance",
  })) {
    const input = el.locator(`[name="${name}"]`);
    if (await input.count()) {
      if ((await input.evaluate((e) => e.tagName)) === "SELECT")
        await input.selectOption(value);
      else await input.fill(value);
    }
  }
  let observed;
  const pattern = base + root + "/**";
  await a.page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    observed = { status: response.status(), data: await response.json() };
    await route.fulfill({ response });
  });
  assert.deepEqual(
    await el.evaluate((form) =>
      [...form.elements]
        .filter((input) => "checkValidity" in input && !input.checkValidity())
        .map((input) => ({
          name: input.name,
          message: input.validationMessage,
        })),
    ),
    [],
    "Browser form must be valid before submission",
  );
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
  await current(a);
  return observed.data.result;
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
  const owner = await actor("owner"),
    teacher = await actor("teacher"),
    reviewer = await actor("reviewer"),
    student = await actor("student"),
    parent = await actor("parent"),
    foreign = await actor("foreign");
  const title = "Synthetic authenticated learning task " + randomUUID();
  let task, release, firstWork, secondWork;
  await check(
    "P10-TASK-BR-01 owner opt-in, exact teacher, independent review and release",
    async () => {
      await open(owner);
      await form(owner, "Adopt learning assignment policy", {
        timeZone: "Africa/Lagos",
        allowFormTasks: "false",
        allowTextSubmissions: "true",
        allowImageReferences: "false",
        allowLateSubmissions: "false",
        allowResubmission: "true",
      });
      await open(teacher);
      const name = await teacher.page
        .getByRole("form", { name: /^Create learning assignment:/ })
        .first()
        .getAttribute("aria-label");
      task = (
        await form(teacher, name, {
          title,
          body: "Synthetic pupil instructions",
          dueAt: new Date(Date.now() + 3600000).toISOString().slice(0, -1),
          submissionsEnabled: "true",
        })
      ).id;
      const article = `Managed learning assignment ${task}`;
      await form(teacher, "Submit learning assignment for review", {}, article);
      assert.equal(
        (
          await api(teacher, `/learning-assignments/${task}/decision`, {
            action: "APPROVE",
            expectedRevision: 1,
            reason: "Self review must deny",
            requestKey: randomUUID(),
          })
        ).status(),
        404,
      );
      await open(reviewer);
      await form(reviewer, "Return learning assignment revision", {}, article);
      await form(
        teacher,
        "Revise learning assignment",
        {
          title,
          body: "Revised synthetic pupil instructions",
          dueAt: new Date(Date.now() + 3600000).toISOString().slice(0, -1),
          submissionsEnabled: "true",
        },
        article,
      );
      await form(teacher, "Submit learning assignment for review", {}, article);
      await form(reviewer, "Approve learning assignment revision", {}, article);
      release = (
        await form(teacher, "Release reviewed learning assignment", {}, article)
      ).id;
    },
  );
  if (process.env.PHASE10_MODULE_BROWSER_ENABLED === "true") {
    await check(
      "P10-MODULE-BR-01 actual task delivery, duplicate suppression and read/unread UI",
      async () => {
        async function drain() {
          for (let i = 0; i < 100; i++) {
            const response = await api(owner, "/module-delivery", {});
            assert.equal(response.status(), 200);
            if (!(await response.json()).processed) return;
          }
          throw Error("Synthetic browser module queue exceeded bounded drain");
        }
        await drain();
        const response = await api(student, "/module-notifications");
        assert.equal(response.status(), 200);
        const inbox = await response.json();
        const item = inbox.items.find((entry) => entry.href.endsWith(release));
        assert.ok(item);
        assert.equal(item.read, false);
        await open(student);
        await form(student, "Mark read", {}, `Notification ${item.id}`);
        assert.equal(
          (
            await (await api(student, "/module-notifications")).json()
          ).items.find((entry) => entry.id === item.id).read,
          true,
        );
        await form(student, "Mark unread", {}, `Notification ${item.id}`);
        await drain();
        const repeated = await (
          await api(student, "/module-notifications")
        ).json();
        assert.equal(
          repeated.items.filter((entry) => entry.id === item.id).length,
          1,
        );
        assert.equal(
          repeated.items.find((entry) => entry.id === item.id).read,
          false,
        );
        for (const actor of [parent, foreign])
          assert.equal(
            (await api(actor, "/module-notifications")).status(),
            404,
          );
        await student.page
          .getByRole("article", {
            name: `Notification ${item.id}`,
            exact: true,
          })
          .getByRole("link", {
            name: "Open current school workflow",
            exact: true,
          })
          .click();
        await student.page.waitForURL(url + "?releaseId=" + release);
        await current(student);
      },
    );
  }
  await check(
    "P10-TASK-BR-02 verified pupil work, return, immutable resubmission and teacher acceptance",
    async () => {
      await open(student, url + "?releaseId=" + release);
      await student.page
        .getByRole("heading", { name: title, exact: true })
        .waitFor();
      firstWork = (
        await form(student, "Submit learning work", {
          text: "Original synthetic pupil work in Chromium",
        })
      ).id;
      await open(teacher, url + "?releaseId=" + release);
      await form(
        teacher,
        "Return submitted work",
        {},
        `Submitted work ${firstWork}`,
      );
      secondWork = (
        await form(student, "Resubmit learning work", {
          text: "Revised synthetic pupil work in Chromium",
        })
      ).id;
      assert.notEqual(secondWork, firstWork);
      await form(
        teacher,
        "Accept submitted work",
        {},
        `Submitted work ${secondWork}`,
      );
      await refresh(student);
      await student.page.getByText("Accepted", { exact: true }).waitFor();
      assert.equal(
        await student.page
          .getByRole("article", { name: /^Submitted work / })
          .count(),
        2,
      );
      assert.equal(
        await student.page
          .getByRole("form", { name: "Resubmit learning work", exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    "P10-TASK-BR-03 guardian, foreign-school and identity-forgery denial",
    async () => {
      for (const a of [parent, foreign])
        for (const path of [
          `/my-learning-assignments?releaseId=${release}`,
          `/learning-assignment-releases/${release}/submissions`,
        ])
          assert.equal((await api(a, path)).status(), 404);
      assert.equal(
        (
          await api(
            student,
            `/learning-assignment-releases/${release}/submissions`,
            {
              studentId: f.pupil,
              text: "Forged identity",
              expectedSubmissionRevision: 0,
              requestKey: randomUUID(),
            },
          )
        ).status(),
        400,
      );
    },
  );
  await check(
    "P10-TASK-BR-04 native hidden tab, Back/Forward, responsive accessibility",
    async () => {
      await open(student, url + "?releaseId=" + release);
      const other = await student.context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await student.page.waitForFunction(
        () => document.visibilityState === "hidden",
      );
      assert.equal(
        await student.page
          .getByText("Revised synthetic pupil instructions", { exact: true })
          .isVisible(),
        false,
      );
      await other.close();
      await student.page.bringToFront();
      await current(student);
      await student.page.goto(url);
      await current(student);
      await student.page.goBack();
      await student.page.waitForURL(url + "?releaseId=" + release);
      await current(student);
      await student.page.goForward();
      await student.page.waitForURL(url);
      await current(student);
      for (const width of [375, 768, 1280]) {
        await student.page.setViewportSize({ width, height: 900 });
        await refresh(student);
        await student.page.addScriptTag({
          path:
            process.env.AXE_MODULE ??
            "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
        });
        const audit = await student.page.evaluate(async () =>
          window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        );
        assert.deepEqual(
          audit.violations.map((v) => ({ id: v.id, impact: v.impact })),
          [],
        );
        assert.ok(
          await student.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
    },
  );
  await check(
    "P10-TASK-BR-05 withdrawal revokes task and submitted-work access",
    async () => {
      await open(teacher);
      await form(
        teacher,
        "Withdraw learning assignment",
        {},
        `Managed learning assignment ${task}`,
      );
      for (const path of [
        `/my-learning-assignments?releaseId=${release}`,
        `/learning-assignment-releases/${release}/submissions`,
      ])
        assert.equal((await api(student, path)).status(), 404);
      await student.page.bringToFront();
      await student.page.reload();
      await current(student);
      assert.equal(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .count(),
        0,
      );
    },
  );
  if (process.env.PHASE10_AUDIT_BROWSER_ENABLED === "true") {
    await check(
      "P10-AUDIT-BR-01 owner metadata UI, tenant denial, accessibility and cross-tab sign-out",
      async () => {
        const auditUrl = `${base}/schools/${f.school}/audit`;
        for (const a of [teacher, student, parent, foreign])
          assert.equal((await api(a, "/audit")).status(), 404);
        const response = await api(owner, "/audit");
        assert.equal(response.status(), 200);
        assert.match(response.headers()["cache-control"], /private.*no-store/);
        const evidence = await response.json();
        assert.ok(evidence.events.length > 0);
        for (const event of evidence.events)
          assert.deepEqual(Object.keys(event).sort(), [
            "action",
            "actorUserId",
            "at",
            "id",
            "source",
          ]);
        await open(owner, auditUrl);
        await owner.page
          .getByText("Source reference:", { exact: false })
          .first()
          .waitFor();
        await owner.page.addScriptTag({
          path:
            process.env.AXE_MODULE ??
            "/workspace/phase8-tools/node_modules/axe-core/axe.min.js",
        });
        const axe = await owner.page.evaluate(async () =>
          window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        );
        assert.deepEqual(
          axe.violations.map((v) => v.id),
          [],
        );
        const other = await owner.context.newPage();
        await other.goto(auditUrl);
        await other
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await owner.page.bringToFront();
        await owner.page.waitForFunction(() =>
          [...document.querySelectorAll("article")].every(
            (el) => !el.checkVisibility(),
          ),
        );
        assert.equal((await api(owner, "/audit")).status(), 401);
        await other.close();
      },
    );
  }
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
            "Terminal identity/enrollment revocation and approved asset intersection remain separate acceptance work",
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

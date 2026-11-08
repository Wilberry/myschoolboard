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
  root = `/api/schools/${f.school}`;
const profile = await mkdtemp("/tmp/phase10-academic-chromium-");
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
async function api(a, path, body) {
  return a.context.request[body ? "post" : "get"](base + root + path, {
    ...(body ? { data: body } : {}),
    headers: { origin: base },
  });
}
async function mutation(a, path, body) {
  const response = await api(a, path, body);
  assert.equal(
    response.status(),
    path.endsWith("/submit") || path.startsWith("/lesson-note-reviews/")
      ? 200
      : 201,
    `Academic mutation ${path}`,
  );
  return response.json();
}
async function inbox(a) {
  const response = await api(a, "/module-notifications");
  assert.equal(response.status(), 200);
  return response.json();
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
  const title = "Synthetic academic lesson " + randomUUID();
  let noteId, item;
  const reviewBody = {
    action: "APPROVE",
    expectedRevision: 1,
    reason: "Independent synthetic academic review",
  };
  async function drain() {
    for (let i = 0; i < 100; i++) {
      const response = await api(owner, "/module-delivery", {});
      assert.equal(response.status(), 200);
      if (!(await response.json()).processed) return;
    }
    throw Error("Bounded academic browser queue exhausted");
  }
  await check(
    "P10-ACADEMIC-BR-01 exact teacher, independent lesson review and current pupil delivery",
    async () => {
      noteId = (
        await mutation(teacher, "/lesson-notes", {
          assignmentId: f.assignment,
          termId: f.term,
          topic: title,
          objectives: "Synthetic academic recipient isolation",
          content: "Synthetic academic lesson content for the intended pupil.",
        })
      ).note.id;
      await mutation(teacher, `/lesson-notes/${noteId}/submit`, {
        expectedRevision: 1,
      });
      await drain();
      assert.ok(
        (await inbox(reviewer)).items.some((i) =>
          i.href.endsWith("/lesson-note-reviews"),
        ),
      );
      assert.equal(
        (
          await api(
            teacher,
            `/lesson-note-reviews/${noteId}/decision`,
            reviewBody,
          )
        ).status(),
        404,
      );
      await mutation(
        reviewer,
        `/lesson-note-reviews/${noteId}/decision`,
        reviewBody,
      );
      await mutation(reviewer, `/lesson-releases/${noteId}/decision`, {
        ...reviewBody,
        action: "RELEASE",
      });
      await drain();
      item = (await inbox(student)).items.find((i) =>
        i.href.endsWith("/my-lessons"),
      );
      assert.ok(item);
      assert.equal(item.read, false);
      const serialized = JSON.stringify(await inbox(student));
      assert.ok(!serialized.includes(title));
      for (const denied of [parent, foreign])
        assert.equal(
          (await api(denied, `/student-lessons/${noteId}`)).status(),
          404,
        );
      assert.equal((await api(foreign, "/module-notifications")).status(), 404);
    },
  );
  await check(
    "P10-ACADEMIC-BR-02 real unified-inbox read action and source-authorized deep link",
    async () => {
      await student.page.bringToFront();
      await student.page.goto(`${base}/schools/${f.school}/inbox`);
      const article = student.page.getByRole("article", {
        name: `Notification ${item.id}`,
        exact: true,
      });
      await article.waitFor();
      const response = student.page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().includes(item.id + "/state"),
      );
      await article
        .getByRole("button", { name: "Mark read", exact: true })
        .click();
      assert.equal((await response).status(), 201);
      assert.equal(
        (await inbox(student)).items.find((i) => i.id === item.id).read,
        true,
      );
      await article
        .getByRole("link", {
          name: "Open current school workflow",
          exact: true,
        })
        .click();
      await student.page.waitForURL(`${base}/schools/${f.school}/my-lessons`);
      await student.page
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByRole("button", { name: "Open lesson", exact: true })
        .click();
      await student.page
        .getByRole("heading", { name: title, exact: true })
        .waitFor();
      assert.equal(
        (await api(student, `/student-lessons/${noteId}`)).status(),
        200,
      );
    },
  );
  await check(
    "P10-ACADEMIC-BR-03 withdrawal removes lesson and notification without duplicate redelivery",
    async () => {
      await mutation(reviewer, `/lesson-releases/${noteId}/decision`, {
        ...reviewBody,
        action: "WITHDRAW",
      });
      await drain();
      assert.ok(!(await inbox(student)).items.some((i) => i.id === item.id));
      assert.equal(
        (await api(student, `/student-lessons/${noteId}`)).status(),
        404,
      );
      await student.page.reload();
      assert.equal(
        await student.page.getByText(title, { exact: true }).count(),
        0,
      );
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
            "Attendance and result-sheet browser workflows remain separate acceptance work",
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

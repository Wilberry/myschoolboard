import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";
import { verifyPhase9DatabaseIdentity } from "./verify-phase9-disposable.mjs";
const docker = (args) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
let identity;
if (process.env.PHASE11_DISPOSABLE_IDENTITY_FILE) {
  identity = JSON.parse(
    await readFile(process.env.PHASE11_DISPOSABLE_IDENTITY_FILE, "utf8"),
  );
  assert.equal(identity.phase, "phase11");
  assert.equal(identity.root, process.cwd());
  assert.equal(identity.port, 3014);
  const physical = JSON.parse(docker(["inspect", identity.id]))[0];
  assert.equal(physical.Config.Labels["codex.task"], "phase11");
  assert.ok(physical.State.Running);
  assert.deepEqual(physical.Mounts, []);
  assert.ok(physical.HostConfig.Tmpfs["/var/lib/postgresql/data"]);
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
} else verifyPhase9DatabaseIdentity(process.env);
const path = process.env.PHASE11_BROWSER_FIXTURE_FILE;
assert.match(path ?? "", /^\/tmp\/phase11-[\w-]+\.json$/);
const f = JSON.parse(await readFile(path, "utf8"));
assert.match(f.school, /^p11-school-/);
const base = identity
  ? `http://localhost:${identity.port}`
  : "http://localhost:3000";
if (!identity) assert.equal(process.env.BETTER_AUTH_URL, base);
const root = `/api/schools/${f.school}/trash`;
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
const db = identity
  ? null
  : new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
if (db) await db.connect();
const contexts = [],
  children = [],
  results = [];
async function actor(name, native = false) {
  let context;
  if (native) {
    assert.ok(process.env.DISPLAY);
    const profile = await mkdtemp("/tmp/phase11-native-");
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
        port = (await readFile(profile + "/DevToolsActivePort", "utf8")).split(
          "\n",
        )[0];
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(port);
    context = (
      await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        noDefaults: true,
      })
    ).contexts()[0];
  } else context = await browser.newContext();
  contexts.push(context);
  let signed;
  for (let i = 0; i < 3; i++) {
    signed = await context.request.post(base + "/api/auth/sign-in/email", {
      data: {
        email: `p11-${name}-${f.tag}@example.test`,
        password: f.password,
      },
      headers: { origin: base },
    });
    if (signed.status() !== 429) break;
    await new Promise((r) => setTimeout(r, 11000));
  }
  assert.equal(signed.status(), 200);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  return { context, page };
}
async function current(p) {
  await p
    .getByText("Current school lifecycle records loaded.", { exact: true })
    .waitFor();
}
async function open(a, platform = false) {
  await a.page.bringToFront();
  await a.page.goto(
    base + (platform ? "/platform/trash" : `/schools/${f.school}/trash`),
  );
  await current(a.page);
}
async function refresh(p) {
  await p.bringToFront();
  const done = p.waitForResponse(
    (r) => r.url().endsWith("/trash") && r.request().method() === "GET",
  );
  await p.getByRole("button", { name: "Recheck access", exact: true }).click();
  await done;
  await current(p);
}
async function form(person, title, values = {}, caseId) {
  await refresh(person.page);
  let scope = person.page;
  if (caseId)
    scope = scope.getByRole("article", {
      name: `Trash record ${caseId}`,
      exact: true,
    });
  const form = scope.getByRole("form", { name: title, exact: true });
  for (const [name, value] of Object.entries(values)) {
    const input = form.locator(`[name="${name}"]`);
    if ((await input.evaluate((e) => e.tagName)) === "SELECT")
      await input.selectOption(value);
    else await input.fill(value);
  }
  await form
    .locator('[name="reason"]')
    .fill("Synthetic browser lifecycle acceptance");
  const url = base + (person === platform ? "/api/platform/trash" : root);
  let observed;
  await person.page.route(url, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    observed = { status: response.status(), body: await response.json() };
    await route.fulfill({ response });
  });
  const done = person.page.waitForResponse(
    (r) => r.url() === url && r.request().method() === "POST",
  );
  done.catch(() => {});
  await form.getByRole("button", { name: title, exact: true }).click();
  await done;
  await person.page.unroute(url);
  assert.equal(observed.status, 201);
  await current(person.page);
  return observed.body.result;
}
async function check(name, fn) {
  await fn();
  results.push({ name, outcome: "PASS" });
  console.log(name, "PASS");
}
let teacher, owner, platform, other, id;
try {
  teacher = await actor("teacher", true);
  owner = await actor("owner");
  platform = await actor("platform");
  other = await actor("other");
  await check("P11-BROWSER-TRASH-AND-ISOLATION", async () => {
    await open(teacher);
    id = (
      await form(teacher, "Move draft to school trash", { noteId: f.noteId })
    ).id;
    const detail = await teacher.context.request.get(
      `${base}/api/schools/${f.school}/lesson-notes/${f.noteId}`,
    );
    assert.equal(detail.status(), 404);
    const foreign = await owner.context.request.get(
      `${base}/api/schools/${f.foreign}/trash`,
    );
    assert.equal(foreign.status(), 404);
    assert.equal(
      (await other.context.request.get(base + "/api/platform/trash")).status(),
      404,
    );
    const otherItems = await other.context.request.get(base + root);
    assert.equal(
      (await otherItems.json()).items.some((x) => x.id === id),
      false,
    );
  });
  await check("P11-BROWSER-NATIVE-PRIVACY", async () => {
    const p = teacher.page;
    const blank = await teacher.context.newPage();
    await blank.goto("about:blank");
    await blank.bringToFront();
    assert.equal(await p.evaluate(() => document.hasFocus()), false);
    assert.equal(
      await p.getByRole("article", { name: `Trash record ${id}` }).isVisible(),
      false,
    );
    await p.bringToFront();
    await current(p);
    await p.getByRole("article", { name: `Trash record ${id}` }).waitFor();
    await p.pdf({ path: "/tmp/phase11-private-print.pdf" });
    assert.equal(
      execFileSync("pdftotext", ["/tmp/phase11-private-print.pdf", "-"], {
        encoding: "utf8",
      }).includes(id),
      false,
    );
    await blank.close();
  });
  await check("P11-BROWSER-RESTORE", async () => {
    await form(teacher, "Restore draft", {}, id);
    const detail = await teacher.context.request.get(
      `${base}/api/schools/${f.school}/lesson-notes/${f.noteId}`,
    );
    assert.equal(detail.status(), 200);
    assert.ok(
      (await detail.text()).includes("Synthetic browser-only private draft"),
    );
  });
  await check("P11-BROWSER-PLATFORM-RECOVERY-AND-HOLD", async () => {
    id = (
      await form(teacher, "Move draft to school trash", { noteId: f.noteId })
    ).id;
    await open(owner);
    await form(owner, "End school recovery", {}, id);
    assert.equal(
      (
        await (await teacher.context.request.get(base + root)).json()
      ).items.some((x) => x.id === id),
      false,
    );
    await open(platform, true);
    const metadata = await platform.context.request.get(
      base + "/api/platform/trash",
    );
    assert.ok(
      !(await metadata.text()).includes("Synthetic browser-only private draft"),
    );
    await form(platform, "Place legal hold", {}, id);
    await form(platform, "Release legal hold", {}, id);
    await form(platform, "Authorize scoped recovery", {}, id);
    await form(teacher, "Restore draft", {}, id);
  });
  await check("P11-BROWSER-HISTORY-ACCESSIBILITY", async () => {
    await open(teacher);
    await teacher.page.goto(base + "/");
    await teacher.page.goBack();
    await current(teacher.page);
    await teacher.page.setViewportSize({ width: 375, height: 850 });
    assert.ok(
      await teacher.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await teacher.page.addScriptTag({ content: axe });
    assert.deepEqual(
      await teacher.page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => v.id),
      ),
      [],
    );
    await teacher.page.keyboard.press("Tab");
    assert.ok(
      await teacher.page.evaluate(
        () => document.activeElement !== document.body,
      ),
    );
  });
  await check("P11-BROWSER-REVOKED-AUTHORITY", async () => {
    id = (
      await form(teacher, "Move draft to school trash", { noteId: f.noteId })
    ).id;
    await teacher.page.bringToFront();
    const changed = identity
      ? JSON.parse(
          docker([
            "exec",
            identity.runner,
            "node",
            "--import",
            "tsx",
            "scripts/revoke-phase11-browser-authority.ts",
            path,
          ]),
        )
      : await db.query(
          'UPDATE "TeacherClassSubjectAssignment" SET "status"=\'REVOKED\' WHERE "schoolId"=$1 AND "id"=(SELECT "assignmentId" FROM "LessonNote" WHERE "schoolId"=$1 AND "id"=$2)',
          [f.school, f.noteId],
        );
    assert.equal(changed.rowCount, 1);
    assert.equal(
      (
        await (await teacher.context.request.get(base + root)).json()
      ).items.some((x) => x.id === id),
      false,
    );
    await teacher.page
      .getByRole("article", { name: `Trash record ${id}` })
      .waitFor({ state: "hidden", timeout: 20000 });
  });
  await check("P11-BROWSER-SIGNOUT", async () => {
    const p = teacher.page;
    const out = p.waitForResponse(
      (r) => r.url() === base + "/api/auth/sign-out",
    );
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    assert.equal((await out).status(), 200);
    assert.equal(
      (await teacher.context.request.get(base + root)).status(),
      401,
    );
  });
} finally {
  await writeFile(
    process.env.PHASE11_BROWSER_RESULTS_FILE ??
      "/tmp/phase11-browser-results.json",
    JSON.stringify(
      {
        results,
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
  if (db) await db.end();
}

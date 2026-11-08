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
assert.match(f.school, /^p10-library-/);
const base = "http://localhost:3001",
  root = `/api/schools/${f.school}`,
  url = `${base}/schools/${f.school}/library`;
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
        email: `p10-library-${name}-${f.tag}@example.test`,
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
async function form(
  a,
  title,
  values = {},
  notice,
  kind = "Managed catalog record",
) {
  await refresh(a);
  let scope = a.page;
  if (notice)
    scope = scope.getByRole("article", {
      name: `${kind} ${notice}`,
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

import sharp from "sharp";
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
  const curator = await actor("browsercurator"),
    scopedTeacher = await actor("browserteacher"),
    owner = await actor("owner"),
    student = await actor("student"),
    parent = await actor("parent"),
    foreign = await actor("foreign");
  const title = "Synthetic browser digital catalog " + randomUUID();
  let entry, catalogRelease, asset, assetRelease;
  await check(
    "P10-LIB-BR-01 independent catalog review, explicit typed publication and metadata-only access",
    async () => {
      await open(curator);
      entry = (
        await form(curator, "Propose catalog record", {
          kind: "DIGITAL_RESOURCE",
          title,
          author: "Synthetic browser author",
          publisher: "Synthetic publisher",
          description: "Original synthetic learning raster catalog",
          provenance:
            "Generated synthetic image; no third-party copyrighted material",
        })
      ).id;
      assert.equal(
        (
          await api(
            curator,
            `/library/catalog/${entry}/reviews`,
            intent({ action: "APPROVE", expectedRevision: 1 }),
          )
        ).status(),
        404,
      );
      await open(owner);
      await form(owner, "Approve catalog metadata", {}, entry);
      catalogRelease = (
        await form(
          owner,
          "Release approved catalog metadata",
          { target: "SCHOOL" },
          entry,
        )
      ).id;
      await open(student);
      assert.ok(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
      assert.equal(
        await student.page
          .getByRole("article")
          .filter({
            has: student.page.getByRole("heading", {
              name: title,
              exact: true,
            }),
          })
          .getByRole("link", {
            name: "Download approved learning image",
            exact: true,
          })
          .count(),
        0,
      );
      for (const actor of [parent, foreign])
        assert.equal(
          (
            await api(actor, "/library/catalog?releaseId=" + catalogRelease)
          ).status(),
          404,
        );
    },
  );
  await check(
    "P10-LIB-BR-02 private upload, clean inspection and independent rights before explicit asset release",
    async () => {
      const directory = await mkdtemp("/tmp/phase10-library-asset-"),
        file = directory + "/synthetic-original.png";
      await writeFile(
        file,
        await sharp({
          create: {
            width: 3,
            height: 3,
            channels: 3,
            background: { r: 30, g: 100, b: 150 },
          },
        })
          .png()
          .toBuffer(),
        { mode: 0o600 },
      );
      await refresh(curator);
      const managed = curator.page.getByRole("article", {
          name: `Managed catalog record ${entry}`,
          exact: true,
        }),
        upload = managed.getByRole("form", {
          name: "Upload private learning image",
          exact: true,
        });
      await upload.locator("[name=file]").setInputFiles(file);
      await upload
        .locator("[name=reason]")
        .fill("Synthetic image for browser rights review");
      let observed;
      const pattern = base + root + `/library/catalog/${entry}/assets`;
      await curator.page.route(pattern, async (route) => {
        const response = await route.fetch();
        observed = { status: response.status(), body: await response.json() };
        await route.fulfill({ response });
      });
      const done = curator.page.waitForResponse(
        (r) => r.url() === pattern && r.request().method() === "POST",
      );
      done.catch(() => {});
      await upload
        .getByRole("button", { name: "Upload for inspection", exact: true })
        .click();
      await done;
      await curator.page.unroute(pattern);
      assert.equal(observed.status, 201);
      asset = observed.body.result.id;
      await current(curator.page);
      await refresh(student);
      assert.equal(
        await student.page
          .getByRole("article")
          .filter({
            has: student.page.getByRole("heading", {
              name: title,
              exact: true,
            }),
          })
          .getByRole("link", {
            name: "Download approved learning image",
            exact: true,
          })
          .count(),
        0,
      );
      await open(owner);
      await owner.page
        .getByRole("article", { name: `Learning asset ${asset}`, exact: true })
        .getByRole("heading", { name: "Image inspection: CLEAN", exact: true })
        .waitFor();
      await form(
        owner,
        "Attest learning image rights",
        {
          basis: "PUBLIC_DOMAIN",
          sourceLicense:
            "Original synthetic browser image generated solely for this acceptance fixture",
        },
        asset,
        "Learning asset",
      );
      assetRelease = (
        await form(
          owner,
          "Release rights-approved learning image",
          {},
          asset,
          "Learning asset",
        )
      ).id;
    },
  );
  await check(
    "P10-LIB-BR-03 current authorized download, private headers and guardian/foreign byte denials",
    async () => {
      await refresh(student);
      const link = student.page
        .getByRole("article")
        .filter({
          has: student.page.getByRole("heading", { name: title, exact: true }),
        })
        .getByRole("link", {
          name: "Download approved learning image",
          exact: true,
        });
      await link.waitFor();
      const href = await link.getAttribute("href");
      assert.equal(
        href,
        root + "/library/asset-releases/" + assetRelease + "/download",
      );
      const response = await student.context.request.get(base + href);
      assert.equal(response.status(), 200);
      assert.match(response.headers()["content-type"], /image\/png/);
      assert.match(response.headers()["cache-control"], /private.*no-store/);
      assert.equal(response.headers()["x-content-type-options"], "nosniff");
      assert.match(response.headers()["content-disposition"], /^attachment;/);
      const data = await response.body();
      const meta = await sharp(data).metadata();
      assert.equal(meta.width, 3);
      assert.equal(meta.height, 3);
      assert.equal(meta.exif, undefined);
      for (const a of [parent, foreign])
        assert.equal((await a.context.request.get(base + href)).status(), 404);
      const download = student.page.waitForEvent("download");
      download.catch(() => {});
      await link.click();
      const received = await download;
      assert.equal(await received.failure(), null);
      assert.match(
        received.suggestedFilename(),
        /^learning-resource-[a-f0-9-]+\.png$/,
      );
    },
  );
  await check(
    "P10-LIB-BR-04 private history, native tab concealment and responsive accessibility",
    async () => {
      await student.page.goto(base + "/schools/" + f.school);
      await student.page.goBack();
      await student.page.waitForURL(url);
      await current(student.page);
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
        await student.page.evaluate(() => document.visibilityState),
        "hidden",
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
      const result = await student.page.evaluate(() =>
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        }),
      );
      assert.deepEqual(
        result.violations.map((v) => v.id),
        [],
      );
    },
  );
  await check(
    "P10-LIB-BR-05 explicit asset withdrawal removes downloads without removing catalog metadata",
    async () => {
      await form(owner, "Withdraw learning image", {}, asset, "Learning asset");
      assert.equal(
        (
          await api(
            student,
            "/library/asset-releases/" + assetRelease + "/download",
          )
        ).status(),
        404,
      );
      await refresh(student);
      assert.ok(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
      );
      assert.equal(
        await student.page
          .getByRole("article")
          .filter({
            has: student.page.getByRole("heading", {
              name: title,
              exact: true,
            }),
          })
          .getByRole("link", {
            name: "Download approved learning image",
            exact: true,
          })
          .count(),
        0,
      );
    },
  );
  await check(
    "P10-LIB-BR-06 catalog withdrawal removes metadata and denies old catalog URL",
    async () => {
      await form(owner, "Withdraw catalog release", {}, entry);
      assert.equal(
        (
          await api(student, "/library/catalog?releaseId=" + catalogRelease)
        ).status(),
        404,
      );
      await refresh(student);
      assert.equal(
        await student.page
          .getByRole("heading", { name: title, exact: true })
          .isVisible(),
        false,
      );
    },
  );
  await check(
    "P10-LIB-BR-07 unrelated staff cannot read class-scoped metadata or licensed bytes",
    async () => {
      const created = await api(
        scopedTeacher,
        "/library/catalog",
        intent({
          kind: "DIGITAL_RESOURCE",
          title: "Synthetic class-scoped browser resource " + randomUUID(),
          author: "Synthetic author",
          publisher: "Synthetic publisher",
          isbn: null,
          description: "Synthetic class-only generated raster",
          provenance: "Original synthetic test pixels, no copyrighted source",
        }),
      );
      assert.equal(created.status(), 201);
      const n = (await created.json()).result.id;
      assert.equal(
        (
          await api(
            owner,
            `/library/catalog/${n}/reviews`,
            intent({ action: "APPROVE", expectedRevision: 1 }),
          )
        ).status(),
        201,
      );
      const published = await api(
        owner,
        `/library/catalog/${n}/releases`,
        intent({ scope: "CLASS", classId: f.room, expectedRevision: 1 }),
      );
      assert.equal(published.status(), 201);
      const r = (await published.json()).result.id;
      assert.equal(
        (await api(curator, "/library/catalog?releaseId=" + r)).status(),
        404,
      );
      assert.equal(
        (await api(student, "/library/catalog?releaseId=" + r)).status(),
        200,
      );
      const pixels = await sharp({
        create: { width: 2, height: 2, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
      const upload = await scopedTeacher.context.request.post(
        base + root + `/library/catalog/${n}/assets`,
        {
          headers: { origin: base },
          multipart: {
            file: {
              name: "synthetic-scoped.png",
              mimeType: "image/png",
              buffer: pixels,
            },
            expectedRevision: "1",
            reason: "Synthetic scoped raster upload",
            requestKey: randomUUID(),
          },
        },
      );
      assert.equal(upload.status(), 201);
      const a = (await upload.json()).result.id;
      const rights = await api(
        owner,
        `/library/assets/${a}/rights`,
        intent({
          catalogReleaseId: r,
          basis: "PUBLIC_DOMAIN",
          sourceLicense:
            "Original generated synthetic image for this exact class",
          permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
          expiresAt: null,
        }),
      );
      assert.equal(rights.status(), 201);
      const released = await api(
        owner,
        `/library/assets/${a}/releases`,
        intent({ rightsId: (await rights.json()).result.id }),
      );
      assert.equal(released.status(), 201);
      const image = (await released.json()).result.id;
      assert.equal(
        (
          await api(curator, "/library/asset-releases/" + image + "/download")
        ).status(),
        404,
      );
      assert.equal(
        (
          await api(student, "/library/asset-releases/" + image + "/download")
        ).status(),
        200,
      );
    },
  );
} catch (e) {
  failure = e;
  console.error(
    e instanceof Error ? e.stack : "Library browser acceptance failed",
  );
} finally {
  const result = {
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
      "No claim of persisted BFCache or physical withdrawal of already downloaded bytes.",
    ],
  };
  await writeFile(
    process.env.PHASE10_BROWSER_RESULT_FILE ??
      "/tmp/phase10-library-browser-result.json",
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  await browser?.close();
  child.kill("SIGTERM");
  if (failure) process.exitCode = 1;
}

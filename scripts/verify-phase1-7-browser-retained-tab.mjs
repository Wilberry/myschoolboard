import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertBrowserFixtureEnvironment,
  assertLocalDockerFixtureTarget,
} from "./browser-fixture-safety.mjs";
import { assertBrowserPupilWorkflowPolicy } from "./browser-pupil-workflow-policy.mjs";
import { browserFixtureEmail } from "./browser-fixture-email.mjs";
import { runMigrationChecksumVerification } from "./verify-migration-checksums.mjs";
import {
  assertNoRevokedFlightDisclosure,
  assertPrivateLessonApi,
  classifyFlightResponse,
} from "./browser-flight-evidence.mjs";

// Holds the original student browser tab open while the guarded product HTTP
// workflow revokes its link. No database reset or unguarded writes are used.
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "http://127.0.0.1:3000";
process.umask(0o077);

function ensure(condition, reason) {
  if (!condition) throw new Error(reason);
}
function command(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 1048576,
  });
  ensure(result.status === 0 && !result.error, "Local safety command failed");
  return result.stdout.trim();
}
function verifyDocker() {
  const context = command("docker", ["context", "show"]);
  const endpoint = command("docker", [
    "context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}",
  ]);
  const ids = command("docker", [
    "compose", "--profile", "test", "ps", "-q", "postgres-test",
  ]).split("\n").filter(Boolean);
  ensure(ids.length === 1, "Expected one running disposable postgres-test");
  const inspected = JSON.parse(command("docker", ["inspect", ids[0]]));
  ensure(Array.isArray(inspected) && inspected.length === 1, "Invalid Docker inspection");
  assertLocalDockerFixtureTarget(endpoint, inspected[0], root);
}
function marked(value, markers) {
  return typeof value === "string" && markers.some((item) => value.includes(item));
}
function cache(response) {
  return response.headers()["cache-control"] ?? null;
}
async function denial(context, url, markers) {
  const response = await context.request.get(url, { timeout: 20000 });
  const data = await response.json();
  assertPrivateLessonApi(response.status(), cache(response), data, markers);
  return { status: response.status(), cacheControl: cache(response), generic: true };
}
async function fixture(prisma) {
  const runId = process.env.BROWSER_FIXTURE_RUN_ID;
  const school = await prisma.school.findUnique({
    where: { slug: "browser-" + runId + "-a" },
    select: { id: true, isActive: true },
  });
  ensure(school?.isActive, "Missing active synthetic school");
  const topic = "Synthetic Browser Lesson " + runId;
  const content = "Synthetic browser-only released lesson content " + runId;
  const note = await prisma.lessonNote.findFirst({
    where: { schoolId: school.id, topic },
    select: { id: true, status: true },
  });
  ensure(note?.status === "APPROVED", "Missing approved synthetic note");
  const [active, revoked, released] = await Promise.all([
    prisma.studentAccountLink.count({
      where: { schoolId: school.id, revocation: null },
    }),
    prisma.studentAccountLinkRevocation.count({ where: { schoolId: school.id } }),
    prisma.lessonReleaseEvent.count({
      where: { schoolId: school.id, noteId: note.id, eventType: "RELEASED" },
    }),
  ]);
  ensure(active === 1 && revoked === 0 && released === 1,
    "Use a fresh prepared fixture with one active link and one release");
  return { runId, schoolId: school.id, noteId: note.id, markers: [topic, content] };
}
async function login(page, f) {
  const home = await page.goto(origin, { waitUntil: "domcontentloaded" });
  ensure(home?.status() === 200, "Local application unavailable");
  await page.locator('input[name="email"]').fill(browserFixtureEmail(f.runId, "studentA"));
  await page.locator('input[name="password"]').fill(process.env.BROWSER_FIXTURE_PASSWORD);
  const loginResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/sign-in/email") &&
    response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in" }).click();
  ensure((await loginResponse).status() === 200, "Synthetic browser login denied");
  await page.getByRole("heading", { name: "Schools" }).waitFor();
}
async function firstFlight(page, f) {
  const pathname = "/schools/" + encodeURIComponent(f.schoolId) + "/my-lessons";
  const captured = page.waitForResponse((response) =>
    new URL(response.url()).pathname === pathname &&
    response.request().headers().rsc === "1",
    { timeout: 25000 });
  await page.getByRole("link", {
    name: /My released lessons and schemes of work/,
  }).click();
  const response = await captured;
  const allHeaders = await response.request().allHeaders();
  const headers = Object.fromEntries(
    Object.entries(allHeaders).filter(([key]) =>
      ["rsc", "accept", "next-router-state-tree", "next-url"].includes(key)),
  );
  const result = classifyFlightResponse({
    url: response.url(), origin, schoolId: f.schoolId,
    status: response.status(),
    contentType: response.headers()["content-type"],
    cacheControl: cache(response),
    body: await response.text(), markers: f.markers,
  });
  ensure(result.route === "student-lessons-page" && result.kind === "flight" &&
    result.status === 200, "Positive protected Flight was not captured");
  ensure(!result.markerPresent || result.privateNoStore,
    "Private lesson appeared in a cacheable Flight");
  return { result, template: { url: response.url(), headers } };
}
async function positiveApi(context, f) {
  const base = origin + "/api/schools/" + f.schoolId + "/student-lessons";
  const list = await context.request.get(base);
  ensure(list.status() === 200 && cache(list) === "private, no-store",
    "Linked lesson list failed cache/status check");
  const listJson = await list.json();
  ensure(Array.isArray(listJson.lessons) &&
    listJson.lessons.some((item) => item.id === f.noteId) &&
    !marked(JSON.stringify(listJson), [f.markers[1]]),
    "Linked list must contain the lesson but not its content");
  const detail = await context.request.get(base + "/" + f.noteId);
  ensure(detail.status() === 200 && cache(detail) === "private, no-store",
    "Linked lesson detail failed cache/status check");
  ensure(marked(JSON.stringify(await detail.json()), f.markers),
    "Released lesson detail is absent");
  return { listStatus: 200, detailStatus: 200, cacheControl: "private, no-store" };
}
async function revoke() {
  // Preserve the original Chromium process/tab; execute the existing
  // explicitly opted-in HTTP revocation workflow in a separate child.
  const child = spawn("npm", [
    "run", "verify:browser:pupil-workflow", "--", "--phase=revoke",
  ], {
    cwd: root, env: process.env, stdio: "ignore",
    detached: process.platform !== "win32",
  });
  function stopOwnedChild() {
    if (!child.pid) return;
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const timeout = setTimeout(stopOwnedChild, 300000);
  process.once("SIGINT", stopOwnedChild);
  process.once("SIGTERM", stopOwnedChild);
  try {
    await new Promise((resolveExit, rejectExit) => {
      child.once("error", () => rejectExit(new Error("Guarded child failed to start")));
      child.once("exit", (code, signal) => code === 0 && signal === null
        ? resolveExit()
        : rejectExit(new Error("Guarded HTTP revocation did not complete")));
    });
  } finally {
    clearTimeout(timeout);
    process.removeListener("SIGINT", stopOwnedChild);
    process.removeListener("SIGTERM", stopOwnedChild);
  }
}
async function run() {
  assertBrowserFixtureEnvironment();
  assertBrowserPupilWorkflowPolicy("revoke");
  ensure(process.env.BETTER_AUTH_URL === origin,
    "Require the exact loopback-only production server origin");
  verifyDocker();
  await runMigrationChecksumVerification();
  const commit = command("git", ["rev-parse", "HEAD"]);
  ensure(/^[a-f0-9]{40}$/i.test(commit), "Missing exact Git commit");

  const { prisma } = await import("../src/lib/db.ts");
  let browser;
  try {
    const f = await fixture(prisma);
    const modulePath = resolve(process.env.HOME ?? "/invalid",
      ".config/myschoolboard/phase17-playwright/node_modules/playwright-core/index.mjs");
    const { chromium } = await import(pathToFileURL(modulePath).href);
    browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const directory = join(resolve(process.env.HOME ?? "/invalid",
      ".config/myschoolboard/phase17-retained-tab"), f.runId);
    await mkdir(directory, { recursive: true, mode: 0o700 });

    await login(page, f);
    const { result: positiveFlight, template } = await firstFlight(page, f);
    await page.getByRole("button", { name: "Open lesson" }).first().click();
    await page.getByRole("heading", { name: f.markers[0], exact: true }).waitFor();
    ensure(marked(await page.locator("body").innerText(), f.markers),
      "Positive original tab does not display released lesson");
    const positive = await positiveApi(context, f);
    await page.emulateMedia({ media: "print" });
    const printDom = marked(await page.locator("body").innerText(), f.markers);
    const printBytes = (await page.pdf()).byteLength;
    await page.emulateMedia({ media: "screen" });
    ensure(printDom && printBytes > 0, "Authorized print evidence missing");

    // Durable, private proof of a successful ORIGINAL tab before revocation.
    // wx prevents overwriting earlier evidence or reusing a consumed fixture.
    await writeFile(join(directory, "positive.json"), JSON.stringify({
      commit, chromeVersion: browser.version(), positive, positiveFlight,
      originalTabVisible: true, printDomHadMarkers: printDom,
      printPdfBytes: printBytes,
    }, null, 2), { flag: "wx", mode: 0o600 });

    await revoke();

    // Capture DOM and printing without navigating or refreshing this old tab.
    const oldTabMarkers = marked(await page.locator("body").innerText(), f.markers);
    await page.emulateMedia({ media: "print" });
    const oldPrintMarkers = marked(await page.locator("body").innerText(), f.markers);
    const oldPdfBytes = (await page.pdf()).byteLength;
    await page.emulateMedia({ media: "screen" });

    const apiRoot = origin + "/api/schools/" + f.schoolId + "/student-lessons";
    const revokedList = await denial(context, apiRoot, f.markers);
    const revokedDetail = await denial(context, apiRoot + "/" + f.noteId, f.markers);
    const flight = await context.request.get(template.url, {
      headers: template.headers, timeout: 20000,
    });
    const afterFlight = classifyFlightResponse({
      url: flight.url(), origin, schoolId: f.schoolId, status: flight.status(),
      contentType: flight.headers()["content-type"],
      cacheControl: cache(flight), body: await flight.text(), markers: f.markers,
    });
    assertNoRevokedFlightDisclosure(afterFlight);

    const reload = await page.reload({ waitUntil: "networkidle" });
    const normalizedMarkers = f.markers.map((marker) => marker.toLowerCase());
    const reloadedText = (await page.locator("body").innerText()).toLowerCase();
    const notFound = /this page could not be found|page not found/.test(reloadedText);
    ensure(notFound && !marked(reloadedText, normalizedMarkers),
      "Reload after revocation displayed lesson");
    await page.goBack({ waitUntil: "networkidle" });
    const backLeak = marked((await page.locator("body").innerText()).toLowerCase(),
      normalizedMarkers);
    await page.goForward({ waitUntil: "networkidle" });
    const forwardLeak = marked((await page.locator("body").innerText()).toLowerCase(),
      normalizedMarkers);
    ensure(!backLeak && !forwardLeak, "History re-exposed revoked lesson");
    const freshTab = await context.newPage();
    const freshResponse = await freshTab.goto(origin + "/schools/" +
      encodeURIComponent(f.schoolId) + "/my-lessons", { waitUntil: "networkidle" });
    const freshLeak = marked((await freshTab.locator("body").innerText()).toLowerCase(),
      normalizedMarkers);
    ensure(!freshLeak, "New tab re-exposed revoked lesson");

    await writeFile(join(directory, "post-revocation.json"), JSON.stringify({
      commit, chromeVersion: browser.version(),
      oldTab: {
        retainedDomMarkers: oldTabMarkers, retainedPrintDomMarkers: oldPrintMarkers,
        generatedPdfBytes: oldPdfBytes,
        note: "Existing rendered content may persist after server-side revocation",
      },
      newServerRequests: {
        revokedList, revokedDetail, flight: afterFlight,
        reloadStatus: reload?.status() ?? null, notFound,
        backLeak, forwardLeak, newTabStatus: freshResponse?.status() ?? null,
        freshLeak,
      },
      acceptance: "SCOPED_ONLY_NOT_ACCEPTED",
    }, null, 2), { flag: "wx", mode: 0o600 });

    console.info(JSON.stringify({
      event: "synthetic_retained_tab_evidence_complete",
      testedCommit: commit,
      positiveEvidenceBeforeRevoke: true,
      sameSessionApiDenied: true,
      revokedFlightMarkerFree: true,
      originalTabRetainedContent: oldTabMarkers,
      oldTabPrintRetainedContent: oldPrintMarkers,
      protectedFlightCacheRequiresReview:
        positiveFlight.requiresReview || afterFlight.requiresReview,
      acceptance: "SCOPED_ONLY_NOT_ACCEPTED",
    }));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}
run().catch((error) => {
  // Never print auth response bodies, cookies, identifiers or library errors.
  console.error(JSON.stringify({
    event: "synthetic_retained_tab_evidence_failed",
    errorType: error instanceof Error ? error.name : "unknown",
    action: "Inspect local private evidence; never rerun against a revoked fixture",
  }));
  process.exitCode = 1;
});

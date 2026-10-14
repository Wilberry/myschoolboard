import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const testSchool = "phase8-http-smoke-no-such-school";
const privatePages = [
  "published-reports",
  "report-publication",
  "private-report-compositions",
  "guardian-links",
];

/** No live credentials, remote hosts, or enabled recipient disclosure. */
export function assertPhase8HttpSmokeTarget(environment) {
  assertLocalVerificationTarget(environment);
  if (
    environment.PHASE8_REPORT_RELEASE_ENABLED !== "false" ||
    environment.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED !== "false"
  ) {
    throw new Error("HTTP smoke requires both Phase 8 disclosure gates OFF");
  }
  let origin;
  let configured;
  try {
    origin = new URL(environment.PHASE8_HTTP_SMOKE_BASE_URL);
    configured = new URL(environment.BETTER_AUTH_URL);
  } catch {
    throw new Error("HTTP smoke requires an explicit local app base URL");
  }
  if (
    origin.href !== configured.href ||
    origin.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    origin.port !== "3000" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new Error(
      "HTTP smoke is restricted to the configured loopback test app on port 3000",
    );
  }
  return origin;
}

function assertPrivateResponse(response, label) {
  const cache = response.headers.get("cache-control") ?? "";
  const robots = response.headers.get("x-robots-tag") ?? "";
  if (
    !cache.includes("private") ||
    !cache.includes("no-store") ||
    !robots.includes("noindex") ||
    response.headers.get("referrer-policy") !== "no-referrer"
  ) {
    throw new Error(
      `${label}: missing private no-store/noindex/no-referrer headers`,
    );
  }
}

/** Read-only, anonymous network probes. No database mutation or session cookies. */
export async function runPhase8HttpSmoke(
  environment = process.env,
  request = fetch,
) {
  const origin = assertPhase8HttpSmokeTarget(environment);
  let passed = 0;
  async function probe(path, expectedStatuses) {
    const url = new URL(path, origin);
    const result = await request(url.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(5000),
      headers: { "Cache-Control": "no-store" },
    });
    if (!expectedStatuses.includes(result.status)) {
      throw new Error(`${path}: unexpectedly returned HTTP ${result.status}`);
    }
    assertPrivateResponse(result, path);
    passed += 1;
  }
  for (const page of privatePages) {
    await probe(`/schools/${testSchool}/${page}`, [307, 308, 401, 404]);
  }
  await probe(`/api/schools/${testSchool}/published-reports`, [404]);
  await probe(
    `/api/schools/${testSchool}/published-reports?studentId=untrusted-child`,
    [400],
  );
  return { passed, expected: privatePages.length + 2 };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runPhase8HttpSmoke()
    .then(({ passed, expected }) => {
      console.info(
        `Phase 8 anonymous HTTP privacy smoke: ${passed}/${expected} passed`,
      );
    })
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "HTTP smoke failed",
      );
      process.exitCode = 1;
    });
}

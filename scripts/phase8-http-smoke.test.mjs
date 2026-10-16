import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPhase8HttpSmokeTarget,
  runPhase8HttpSmoke,
} from "./phase8-http-smoke.mjs";

const environment = Object.freeze({
  NODE_ENV: "test",
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  DATABASE_URL:
    "postgresql://myschoolboard:synthetic@127.0.0.1:5434/myschoolboard_test?schema=public",
  TEST_DATABASE_URL:
    "postgresql://myschoolboard:synthetic@127.0.0.1:5434/myschoolboard_test?schema=public",
  BETTER_AUTH_SECRET: "synthetic-phase8-test-secret-of-sufficient-length",
  BETTER_AUTH_URL: "http://127.0.0.1:3000/",
  PHASE8_HTTP_SMOKE_BASE_URL: "http://127.0.0.1:3000/",
  DEV_ADMIN_EMAIL: "admin@synthetic.test",
  DEV_ADMIN_PASSWORD: "synthetic-password-just-for-tests",
  PHASE8_REPORT_RELEASE_ENABLED: "false",
  PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "false",
});
const privacy = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "Referrer-Policy": "no-referrer",
};

function fixtureRequest(
  modify = (_path, status, headers) => ({ status, headers }),
) {
  const calls = [];
  const request = async (url, options) => {
    const path = new URL(url).pathname;
    const status = path.includes("/api/")
      ? new URL(url).search
        ? 400
        : 404
      : 307;
    calls.push({ url, options });
    const headers = status === 307 ? { ...privacy, Location: "/" } : privacy;
    const result = modify(path, status, headers, url);
    return new Response(null, result);
  };
  return { calls, request };
}

test("allows only disposable loopback with both report gates off", () => {
  assert.equal(
    assertPhase8HttpSmokeTarget(environment).href,
    environment.BETTER_AUTH_URL,
  );
  for (const changes of [
    { NODE_ENV: "production" },
    { TEST_DATABASE_DISPOSABLE: "0" },
    { DATABASE_URL: "postgresql://prod@shared:5434/myschoolboard_test" },
    { PHASE8_REPORT_RELEASE_ENABLED: "true" },
    { PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED: "true" },
    { PHASE8_REPORT_RELEASE_ENABLED: undefined },
    { PHASE8_HTTP_SMOKE_BASE_URL: "https://evil.example/" },
    { PHASE8_HTTP_SMOKE_BASE_URL: "http://127.0.0.1:3001/" },
    { PHASE8_HTTP_SMOKE_BASE_URL: "http://user@127.0.0.1:3000/" },
    { PHASE8_HTTP_SMOKE_BASE_URL: "http://127.0.0.1:3000/private" },
    { PHASE8_HTTP_SMOKE_BASE_URL: undefined },
  ]) {
    assert.throws(() =>
      assertPhase8HttpSmokeTarget({ ...environment, ...changes }),
    );
  }
});

test("checks six anonymous endpoints without cookies or writes", async () => {
  const { calls, request } = fixtureRequest();
  assert.deepEqual(await runPhase8HttpSmoke(environment, request), {
    passed: 6,
    expected: 6,
  });
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls.map(({ url }) => new URL(url).origin)).size, 1);
  assert.equal(calls.filter(({ url }) => url.includes("studentId=")).length, 1);
  for (const { options } of calls) {
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.redirect, "manual");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers["Cache-Control"], "no-store");
  }
});

test("rejects exposed pages, APIs and query-selector responses", async () => {
  for (const change of [
    (path, status, headers) => ({
      status: path.endsWith("/published-reports") ? 200 : status,
      headers,
    }),
    (path, status, headers) => ({
      status: path.includes("/api/") ? 200 : status,
      headers,
    }),
    (path, status, headers, url) => ({
      status: url.includes("studentId=") ? 200 : status,
      headers,
    }),
  ]) {
    const { request } = fixtureRequest(change);
    await assert.rejects(
      runPhase8HttpSmoke(environment, request),
      /unexpectedly returned/,
    );
  }
});

test("accepts a Next.js 307 login redirect with no-store alone", async () => {
  const { request } = fixtureRequest((_path, status, headers) => ({
    status,
    headers: {
      ...headers,
      "Cache-Control": status === 307 ? "no-store" : headers["Cache-Control"],
    },
  }));
  assert.deepEqual(await runPhase8HttpSmoke(environment, request), {
    passed: 6,
    expected: 6,
  });
});

test("still requires private for denied nonredirect pages and API responses", async () => {
  for (const change of [
    (path, status, headers) => ({
      status,
      headers: {
        ...headers,
        "Cache-Control": path.includes("/api/")
          ? "no-store"
          : headers["Cache-Control"],
      },
    }),
    (path, status, headers) => ({
      status: path.endsWith("/guardian-links") ? 404 : status,
      headers: {
        ...headers,
        "Cache-Control": path.endsWith("/guardian-links")
          ? "no-store"
          : headers["Cache-Control"],
      },
    }),
  ]) {
    const { request } = fixtureRequest(change);
    await assert.rejects(
      runPhase8HttpSmoke(environment, request),
      /missing secure/,
    );
  }
});

test("rejects missing or external redirects, permanent redirects and public caching", async () => {
  for (const change of [
    (path, status, headers) => ({
      status,
      headers: {
        ...headers,
        Location: path.endsWith("/published-reports")
          ? "https://attacker.example/"
          : "/",
      },
    }),
    (path, status, headers) => ({
      status,
      headers: {
        ...headers,
        Location: path.endsWith("/published-reports") ? "/foreign" : "/",
      },
    }),
    (path, status, headers) => ({
      status,
      headers: {
        ...headers,
        ...(path.endsWith("/published-reports") ? { Location: "" } : {}),
      },
    }),
    (_path, status, headers) => ({
      status: status === 307 ? 308 : status,
      headers,
    }),
    (_path, status, headers) => ({
      status,
      headers: { ...headers, "Cache-Control": "public, no-store" },
    }),
    (_path, status, headers) => ({
      status,
      headers: { ...headers, "Cache-Control": "no-store, s-maxage=3600" },
    }),
  ]) {
    const { request } = fixtureRequest(change);
    await assert.rejects(runPhase8HttpSmoke(environment, request));
  }
});

test("rejects missing no-store, noindex or no-referrer", async () => {
  for (const name of ["Cache-Control", "X-Robots-Tag", "Referrer-Policy"]) {
    const headers = { ...privacy };
    delete headers[name];
    const { request } = fixtureRequest((_path, status) => ({
      status,
      headers,
    }));
    await assert.rejects(
      runPhase8HttpSmoke(environment, request),
      /missing secure/,
    );
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { getSessionCookieHeader } from "./browser-pupil-workflow-auth.mjs";
import { assertBrowserPupilWorkflowPolicy } from "./browser-pupil-workflow-policy.mjs";

const base = {
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  BROWSER_PUPIL_WORKFLOW_WRITE: "1",
  BROWSER_PUPIL_REVOKE: "1",
};

test("allows explicit synthetic pupil preparation on localhost", () => {
  assert.equal(assertBrowserPupilWorkflowPolicy("prepare", base), "prepare");
  assert.equal(
    assertBrowserPupilWorkflowPolicy("prepare", {
      ...base,
      BETTER_AUTH_URL: "http://localhost:3001",
    }),
    "prepare",
  );
});

test("allows verification without a mutation opt-in", () => {
  const environment = {
    ...base,
    BETTER_AUTH_URL: "http://localhost:3000",
    BROWSER_PUPIL_WORKFLOW_WRITE: "0",
    BROWSER_PUPIL_REVOKE: "0",
  };
  assert.equal(
    assertBrowserPupilWorkflowPolicy("verify", environment),
    "verify",
  );
});

test("rejects missing write opt-in for preparation", () => {
  assert.throws(
    () =>
      assertBrowserPupilWorkflowPolicy("prepare", {
        ...base,
        BROWSER_PUPIL_WORKFLOW_WRITE: "0",
      }),
    /opt-in/,
  );
});

test("requires separate explicit consent for link revocation", () => {
  assert.throws(
    () =>
      assertBrowserPupilWorkflowPolicy("revoke", {
        ...base,
        BROWSER_PUPIL_REVOKE: "0",
      }),
    /separate/,
  );
});

test("rejects revoked write consent even with revoke opt-in", () => {
  assert.throws(
    () =>
      assertBrowserPupilWorkflowPolicy("revoke", {
        ...base,
        BROWSER_PUPIL_WORKFLOW_WRITE: "0",
      }),
    /opt-in/,
  );
});

test("rejects non-loopback or unexpected authentication origins", () => {
  for (const value of [
    "http://example.test:3000",
    "http://0.0.0.0:3000",
    "https://localhost:3000",
    "http://localhost",
    "http://localhost:3001/path",
    "http://localhost:3001?query=1",
    "http://localhost:3001#fragment",
    "",
  ]) {
    assert.throws(
      () =>
        assertBrowserPupilWorkflowPolicy("verify", {
          ...base,
          BETTER_AUTH_URL: value,
        }),
      /loopback/,
    );
  }
});

test("rejects every unsupported workflow phase", () => {
  for (const value of ["", "cleanup", "reset", "seed", "deploy", undefined]) {
    assert.throws(
      () => assertBrowserPupilWorkflowPolicy(value, base),
      /Phase must/,
    );
  }
});

test("HTTP sign-in accepts exactly one secure or non-secure session cookie", () => {
  const headers = {
    getSetCookie: () => [
      "myschoolboard.session_data=cache; Path=/; HttpOnly",
      "__Secure-myschoolboard.session_token=opaque; Path=/; Secure; HttpOnly",
    ],
  };

  assert.equal(
    getSessionCookieHeader(headers),
    "__Secure-myschoolboard.session_token=opaque",
  );
});

test("HTTP sign-in rejects missing or ambiguous session cookies", () => {
  assert.throws(
    () => getSessionCookieHeader({ getSetCookie: () => [] }),
    /exactly one synthetic session cookie/,
  );
  assert.throws(
    () =>
      getSessionCookieHeader({
        getSetCookie: () => [
          "myschoolboard.session_token=one",
          "__Secure-myschoolboard.session_token=two",
        ],
      }),
    /exactly one synthetic session cookie/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoRevokedFlightDisclosure,
  assertPrivateLessonApi,
  classifyFlightResponse,
} from "./browser-flight-evidence.mjs";

const base = {
  origin: "http://127.0.0.1:3000",
  schoolId: "synthetic-school-uuid",
  status: 200,
  contentType: "text/x-component",
  cacheControl: "private, no-cache, no-store, max-age=0",
  body: "neutral Flight shell",
  markers: ["Synthetic Browser Lesson confidential-label"],
};

test("classifies pupil Flight by URL pathname without copying IDs or query", () => {
  const record = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons?_rsc=opaque",
  });
  assert.equal(record.route, "student-lessons-page");
  assert.equal(record.kind, "flight");
  assert.equal(record.privateNoStore, true);
  assert.equal(record.markerPresent, false);
  assert.equal(record.requiresReview, false);
  assert.doesNotMatch(JSON.stringify(record), /synthetic-school-uuid|opaque/);
});

test("flags unattributed or cacheable protected Flight without asserting disclosure", () => {
  const record = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons",
    cacheControl: "s-maxage=31536000",
  });
  assert.equal(record.requiresReview, true);
  assert.equal(record.markerPresent, false);
  const missing = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons",
    cacheControl: null,
  });
  assert.equal(missing.cachePolicy, "MISSING");
  assert.equal(missing.requiresReview, true);
});

test("does not incorrectly attribute another route's cache policy to the pupil page", () => {
  const record = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid?_rsc=opaque",
    cacheControl: "s-maxage=31536000",
  });
  assert.equal(record.route, "school-workspace");
  assert.equal(record.requiresReview, false);
});

test("requires valid origin and markers, rejects cross-origin capture", () => {
  assert.throws(
    () =>
      classifyFlightResponse({
        ...base,
        url: "http://remote.invalid/schools/synthetic-school-uuid/my-lessons",
      }),
    /Invalid synthetic Flight capture target/,
  );
  assert.throws(
    () =>
      classifyFlightResponse({
        ...base,
        url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons",
        markers: [],
      }),
    /markers are required/,
  );
});

test("detects synthetic marker even when route has otherwise private cache headers", () => {
  const record = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons",
    body: "Synthetic Browser Lesson confidential-label",
  });
  assert.equal(record.markerPresent, true);
  assert.throws(
    () => assertNoRevokedFlightDisclosure(record),
    /privacy assertion failed/,
  );
});

test("revoked Flight must be exact route, Flight type, 200, and marker-free", () => {
  const record = classifyFlightResponse({
    ...base,
    url: "http://127.0.0.1:3000/schools/synthetic-school-uuid/my-lessons",
  });
  assert.doesNotThrow(() => assertNoRevokedFlightDisclosure(record));
  for (const changes of [
    { status: 500 },
    { route: "other" },
    { kind: "not-flight" },
  ]) {
    assert.throws(
      () => assertNoRevokedFlightDisclosure({ ...record, ...changes }),
      /privacy assertion failed/,
    );
  }
});

test("requires generic non-cacheable revoked lesson-list and detail responses", () => {
  assert.doesNotThrow(() =>
    assertPrivateLessonApi(
      404,
      "private, no-store",
      { error: "Not found" },
      base.markers,
    ),
  );
  for (const [status, cache, body] of [
    [200, "private, no-store", { error: "Not found" }],
    [404, "public, max-age=60", { error: "Not found" }],
    [404, "private, no-store", { error: "Not found", studentId: "oops" }],
    [404, "private, no-store", { error: "Synthetic Browser Lesson confidential-label" }],
  ]) {
    assert.throws(
      () => assertPrivateLessonApi(status, cache, body, base.markers),
      /generic private denial/,
    );
  }
});

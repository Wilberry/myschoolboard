/**
 * Safe, route-aware metadata for synthetic Next.js Flight responses.
 * Never persist raw response bodies, query strings, cookies or student IDs.
 */
export function classifyFlightResponse({
  url,
  origin,
  schoolId,
  status,
  contentType,
  cacheControl,
  body,
  markers,
}) {
  const parsed = new URL(url);
  if (parsed.origin !== origin || !schoolId || !Array.isArray(markers)) {
    throw new Error("Invalid synthetic Flight capture target");
  }
  if (!markers.length || markers.some((item) => typeof item !== "string" || !item)) {
    throw new Error("Synthetic Flight markers are required");
  }
  const lessonPath = `/schools/${encodeURIComponent(schoolId)}/my-lessons`;
  const schoolPath = `/schools/${encodeURIComponent(schoolId)}`;
  const route =
    parsed.pathname === lessonPath
      ? "student-lessons-page"
      : parsed.pathname === schoolPath
        ? "school-workspace"
        : "other";
  const type = typeof contentType === "string" ? contentType : "";
  const cache = typeof cacheControl === "string" ? cacheControl : "";
  const isFlight = /^text\/x-component(?:;|$)/i.test(type.trim());
  const privateNoStore =
    /(?:^|,)\s*private\s*(?:,|$)/i.test(cache) &&
    /(?:^|,)\s*no-store\s*(?:,|$)/i.test(cache);
  const markerPresent =
    typeof body === "string" && markers.some((marker) => body.includes(marker));

  return {
    route,
    // The exact ephemeral path and query string are intentionally not recorded.
    kind: isFlight ? "flight" : "not-flight",
    status,
    cachePolicy: cache ? cache.slice(0, 180) : "MISSING",
    privateNoStore,
    markerPresent,
    requiresReview:
      isFlight && route === "student-lessons-page" && !privateNoStore,
  };
}

export function assertNoRevokedFlightDisclosure(record) {
  if (
    record?.route !== "student-lessons-page" ||
    record?.kind !== "flight" ||
    record?.status !== 200 ||
    record?.markerPresent
  ) {
    throw new Error("Revoked student Flight privacy assertion failed");
  }
}

export function assertPrivateLessonApi(status, cacheControl, body, markers) {
  if (
    status !== 404 ||
    cacheControl !== "private, no-store" ||
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    body.error !== "Not found" ||
    markers.some((marker) => JSON.stringify(body).includes(marker))
  ) {
    throw new Error("Revoked lesson API must provide generic private denial");
  }
}

export function getSessionCookieHeader(headers) {
  if (!headers || typeof headers.getSetCookie !== "function") {
    throw new Error("HTTP sign-in did not provide cookie headers");
  }

  const sessionCookies = headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter((cookie) => /(?:^|[.-])session_token=/.test(cookie));

  if (sessionCookies.length !== 1) {
    throw new Error("Expected exactly one synthetic session cookie");
  }

  return sessionCookies[0];
}

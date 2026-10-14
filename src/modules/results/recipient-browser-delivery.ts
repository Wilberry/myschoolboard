/**
 * Browser-side report delivery uses one narrow, uncached same-origin GET.
 * The server remains the authority for every user, school, pupil and release.
 * The caller must discard any previously displayed rows before revalidation.
 */
export async function fetchCurrentRecipientRows<Row>(
  url: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Row[]> {
  // Abort is also checked after each await: a mocked, polyfilled or
  // noncompliant transport may resolve even after its signal was aborted.
  // Stale rows must not be promoted into printable recipient state.
  if (signal?.aborted) throw new Error("Recipient report request cancelled");
  const response = await fetcher(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (signal?.aborted) throw new Error("Recipient report request cancelled");
  if (!response.ok) throw new Error("Recipient report unavailable");
  const payload: unknown = await response.json();
  if (signal?.aborted) throw new Error("Recipient report request cancelled");
  if (
    !payload ||
    typeof payload !== "object" ||
    !("reports" in payload) ||
    !Array.isArray(payload.reports) ||
    payload.reports.length > 100
  ) {
    throw new Error("Invalid recipient report response");
  }
  return payload.reports as Row[];
}

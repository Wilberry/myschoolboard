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
  const response = await fetcher(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("Recipient report unavailable");
  const payload: unknown = await response.json();
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

/**
 * Treat rejected auth requests and returned auth errors identically.
 * Client surfaces generic UI feedback rather than server/provider details.
 */
export async function authRequestSucceeded(
  request: () => Promise<{ error?: unknown } | undefined>,
): Promise<boolean> {
  try {
    const result = await request();
    return result?.error == null;
  } catch {
    return false;
  }
}

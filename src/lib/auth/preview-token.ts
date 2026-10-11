/** Preview tokens must never override deployed OAuth session cookies. */
export function readPreviewBearerToken(hostname: string, read: () => string | null): string | null {
  if (!hostname.endsWith(".grok-sandbox.com")) return null;
  try {
    return read();
  } catch {
    return null;
  }
}

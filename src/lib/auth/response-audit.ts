/** Audit failures must never discard an authentication response or its cookies. */
export async function preserveAuthResponse(
  response: Response,
  audit: () => Promise<void>,
  report: () => void = () => console.error("[auth] Session audit failed"),
): Promise<Response> {
  try {
    await audit();
  } catch {
    report();
  }
  return response;
}

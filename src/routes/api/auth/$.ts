import { createFileRoute } from "@tanstack/react-router";
import { auth, recordSessionEvent } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { configuration } from "@/lib/shop/operations-service.server";
async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  if (request.method === "POST" && path.endsWith("/sign-in/social")) {
    const data = await request
      .clone()
      .json()
      .catch(() => null);
    if (data?.provider === "google" && !(await configuration(await getSql())).google)
      return Response.json({ message: "ช่องทาง Google ปิดชั่วคราว" }, { status: 403 });
  }
  if (request.method === "POST" && path.endsWith("/sign-in/email")) {
    const data = await request
      .clone()
      .json()
      .catch(() => null);
    if (typeof data?.email === "string") {
      const [member] = await (
        await getSql()
      ).query<{ disabled: boolean }>(
        'SELECT m.disabled FROM member_profiles m JOIN "user" u ON u.id=m.user_id WHERE lower(u.email)=lower($1)',
        [data.email],
      );
      if (member?.disabled)
        return Response.json({ message: "ไม่สามารถเข้าสู่ระบบได้" }, { status: 403 });
    }
  }
  const previous = path.endsWith("/sign-out")
    ? await auth.api.getSession({ headers: request.headers })
    : null;
  const response = await auth.handler(request);
  if (response.ok && previous?.user)
    await recordSessionEvent({ userId: previous.user.id }, "auth.logout");
  if (response.ok && (path.endsWith("/sign-in/email") || path.endsWith("/sign-up/email"))) {
    const result = await response
      .clone()
      .json()
      .catch(() => null);
    if (result?.user?.id && result?.token)
      await recordSessionEvent(
        { userId: result.user.id, userAgent: request.headers.get("user-agent") },
        "auth.login",
      );
  }
  if (path.includes("/callback/") && response.status >= 300 && response.status < 400) {
    const cookies = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (cookies) {
      const headers = new Headers(request.headers);
      headers.set("cookie", cookies);
      const session = await auth.api.getSession({ headers });
      if (session?.user)
        await recordSessionEvent(
          { userId: session.user.id, userAgent: request.headers.get("user-agent") },
          "auth.login",
        );
    }
  }
  return response;
}
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { auth, recordSessionEvent } from "@/lib/auth/server";
import { authRuntimeReadiness } from "@/lib/auth/runtime-readiness";
import { preserveAuthResponse } from "@/lib/auth/response-audit";
import { getSql } from "@/lib/db";
import { configuration } from "@/lib/shop/operations-service.server";
async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  const readiness = authRuntimeReadiness(process.env);
  if (request.method === "GET" && path.endsWith("/session-status")) {
    return Response.json(readiness, { headers: { "Cache-Control": "no-store" } });
  }
  if (
    !readiness.ready &&
    (path.endsWith("/sign-in/social") ||
      path.endsWith("/sign-in/email") ||
      path.endsWith("/sign-up/email"))
  ) {
    return Response.json(
      {
        code: "AUTH_CONFIGURATION_REQUIRED",
        message: "ระบบสมาชิกยังไม่พร้อม: ผู้ดูแลต้องตั้งค่า " + readiness.missing.join(", "),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    request.method === "POST" &&
    path.endsWith("/request-password-reset") &&
    !(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
  ) {
    return Response.json(
      { code: "EMAIL_NOT_CONFIGURED", message: "บริการรีเซ็ตรหัสผ่านยังไม่พร้อม กรุณาติดต่อร้าน" },
      { status: 503 },
    );
  }
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
  return preserveAuthResponse(response, async () => {
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
        headers.delete("authorization");
        const session = await auth.api.getSession({ headers });
        if (session?.user)
          await recordSessionEvent(
            { userId: session.user.id, userAgent: request.headers.get("user-agent") },
            "auth.login",
          );
      }
    }
  });
}
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});

import { createFileRoute } from "@tanstack/react-router";
// Slip uploads are accepted only through the authenticated cart checkout flow.
export const Route = createFileRoute("/api/slip/verify")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          service: "veltshop-slip-verification",
          auto_release: false,
          flow: "PromptPay cart checkout; authenticated server-side slip verification",
        }),
      POST: () =>
        Response.json(
          { ok: false, credited: 0, message: "ส่งสลิปผ่านหน้ารายการสั่งซื้อในตะกร้าเท่านั้น" },
          { status: 410 },
        ),
    },
  },
});

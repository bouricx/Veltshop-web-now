import { createFileRoute } from "@tanstack/react-router";
// The unauthenticated localhost verifier has been retired. Wallet verification
// runs only through the authenticated topupWithSlip server function.
export const Route = createFileRoute("/api/slip/verify")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          service: "veltshop-slip-verification",
          auto_release: false,
          flow: "signed-in shop topup",
        }),
      POST: () =>
        Response.json(
          { ok: false, credited: 0, message: "กรุณาเข้าสู่ระบบและส่งสลิปผ่านหน้าเติมเงิน" },
          { status: 410 },
        ),
    },
  },
});

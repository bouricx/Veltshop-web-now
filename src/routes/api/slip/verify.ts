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
          flow: "cart product lists; customer payments disabled",
        }),
      POST: () =>
        Response.json(
          { ok: false, credited: 0, message: "ร้านรับรายการสินค้าผ่านตะกร้า ไม่รับเติมเงินหรือสลิป" },
          { status: 410 },
        ),
    },
  },
});

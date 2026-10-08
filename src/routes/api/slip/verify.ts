/**
 * Website slip-verify facade — proxies to the shared service on :8787
 * (veltshop-discord-topup). Discord and web share the same verifier.
 * Never credits wallet here; credit only via topupWithSlip / processPayment
 * after the server itself re-verifies the slip image.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  VERIFIER_PROMPTPAY,
  slipApiBase,
  verifySlipWithSharedApi,
} from "@/lib/shop/slip-verify-upstream.server";

const SLIP_API_BASE = slipApiBase();

export const Route = createFileRoute("/api/slip/verify")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          service: "veltshop-web-slip-proxy",
          method: "POST",
          path: "/api/slip/verify",
          upstream: `${SLIP_API_BASE}/v1/verify-slip`,
          promptpay: VERIFIER_PROMPTPAY,
          auto_release: false,
          accepts: ["multipart/form-data"],
          body: {
            file: "slip image (required)",
            amount: "expected THB amount (required)",
            orderId: "optional; if omitted a temporary order is created on 8787",
          },
          passRule:
            "ok===true only when shared verifier matches amount + PromptPay; never auto-releases product codes; wallet credit only via topupWithSlip",
        }),
      POST: async ({ request }) => {
        try {
          const out = await proxyVerify(request);
          return Response.json(out.body, { status: out.httpStatus });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              status: "uncertain",
              reason: err instanceof Error ? err.message : "proxy verify failed",
              credited: 0,
              paymentId: null,
              orderId: null,
              upstream: SLIP_API_BASE,
            },
            { status: 502 },
          );
        }
      },
    },
  },
});

async function proxyVerify(request: Request): Promise<{
  httpStatus: number;
  body: Record<string, unknown>;
}> {
  const ctype = request.headers.get("content-type") || "";
  if (!ctype.includes("multipart/form-data")) {
    return {
      httpStatus: 400,
      body: {
        ok: false,
        status: "rejected",
        reason: "multipart/form-data required (fields: file, amount, optional orderId)",
        credited: 0,
        paymentId: null,
        orderId: null,
      },
    };
  }

  const form = await request.formData();
  const amount = Number(form.get("amount") || 0);
  const file = form.get("file");
  const clientOrderId = form.get("orderId") ? String(form.get("orderId")) : "";

  if (!(file instanceof File) && !(file && typeof file === "object" && "arrayBuffer" in (file as object))) {
    return {
      httpStatus: 400,
      body: { ok: false, status: "rejected", reason: "file is required", credited: 0, paymentId: null, orderId: null },
    };
  }
  if (!(amount > 0)) {
    return {
      httpStatus: 400,
      body: { ok: false, status: "rejected", reason: "amount is required and must be > 0", credited: 0, paymentId: null, orderId: null },
    };
  }

  const fileObj = file as File;
  const result = await verifySlipWithSharedApi({
    file: fileObj,
    fileName: fileObj.name || "slip.png",
    amount,
    orderId: clientOrderId || undefined,
  });

  return {
    httpStatus: result.httpStatus,
    body: {
      ok: result.ok,
      status: result.status,
      reason: result.reason,
      matchedAmount: result.ok || result.amountFound != null,
      matchedAccount: result.promptpayMatched,
      amountFound: result.amountFound,
      promptpayMatched: result.promptpayMatched,
      ocrTextPreview: result.ocrTextPreview,
      orderId: result.orderId,
      orderStatus: result.orderStatus,
      codesDelivered: false, // auto_release=false — never surface codes from verify proxy
      credited: 0,
      paymentId: null,
      upstream: result.upstream,
      promptpay: VERIFIER_PROMPTPAY,
    },
  };
}

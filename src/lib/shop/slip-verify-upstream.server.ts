/**
 * Server-only caller for the shared slip verifier (:8787).
 * Used by POST /api/slip/verify and by processPayment — credit must never
 * rely on a client-supplied slipVerified flag.
 *
 * PromptPay destination hardcoded in the verifier is 0928160016.
 * shop_settings.receive_account in DB must stay aligned with that number;
 * changing the DB alone does not change :8787 match rules.
 * Do NOT reintroduce Slip2Go / Thunder as live credit providers.
 */
export const VERIFIER_PROMPTPAY = "0928160016";

const SLIP_API_BASE =
  (typeof process !== "undefined" && process.env.SLIP_VERIFY_URL?.trim()) ||
  "http://127.0.0.1:8787";

export type UpstreamVerifyResult = {
  ok: boolean;
  status: "verified" | "rejected" | "uncertain";
  reason: string;
  amountFound: number | null;
  promptpayMatched: boolean;
  ocrTextPreview: string;
  orderId: string | null;
  orderStatus: string | null;
  httpStatus: number;
  upstream: Record<string, unknown>;
};

function isVsOrderId(id: string): boolean {
  return /^VS-\d{8}-[A-Z0-9]+$/i.test(id);
}

/** Create order (if needed) + POST /v1/verify-slip on the shared API. */
export async function verifySlipWithSharedApi(input: {
  file: Blob;
  fileName?: string;
  amount: number;
  orderId?: string;
}): Promise<UpstreamVerifyResult> {
  const amount = Number(input.amount) || 0;
  let orderId = input.orderId && isVsOrderId(input.orderId) ? input.orderId : "";

  if (!(amount > 0)) {
    return {
      ok: false,
      status: "rejected",
      reason: "amount is required and must be > 0",
      amountFound: null,
      promptpayMatched: false,
      ocrTextPreview: "",
      orderId: null,
      orderStatus: null,
      httpStatus: 400,
      upstream: {},
    };
  }

  if (!orderId.trim()) {
    const createRes = await fetch(`${SLIP_API_BASE}/v1/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer: "web-topup",
        product: "wallet-topup",
        amount,
        mark_awaiting_slip: true,
      }),
    });
    const created = (await createRes.json()) as {
      ok?: boolean;
      order?: { id: string };
      detail?: unknown;
    };
    if (!createRes.ok || !created.order?.id) {
      return {
        ok: false,
        status: "uncertain",
        reason: `failed to create upstream order: ${JSON.stringify(created.detail ?? created)}`,
        amountFound: null,
        promptpayMatched: false,
        ocrTextPreview: "",
        orderId: null,
        orderStatus: null,
        httpStatus: 502,
        upstream: created as Record<string, unknown>,
      };
    }
    orderId = created.order.id;
  }

  const upstreamForm = new FormData();
  upstreamForm.set("file", input.file, input.fileName || "slip.png");
  upstreamForm.set("order_id", orderId);
  upstreamForm.set("amount", String(amount));

  const verifyRes = await fetch(`${SLIP_API_BASE}/v1/verify-slip`, {
    method: "POST",
    body: upstreamForm,
  });
  const raw = (await verifyRes.json()) as Record<string, unknown>;

  const ok = raw.ok === true;
  const reason = String(raw.reason ?? raw.detail ?? (ok ? "match" : "verify_failed"));
  const status: UpstreamVerifyResult["status"] = ok
    ? "verified"
    : reason.includes("uncertain")
      ? "uncertain"
      : "rejected";

  const amountFound =
    typeof raw.amount_found === "number"
      ? raw.amount_found
      : raw.amount_found != null && Number.isFinite(Number(raw.amount_found))
        ? Number(raw.amount_found)
        : null;

  return {
    ok,
    status,
    reason,
    amountFound,
    promptpayMatched: raw.promptpay_matched === true,
    ocrTextPreview: String(raw.raw_text_snippet ?? "").slice(0, 500),
    orderId: typeof raw.order_id === "string" ? raw.order_id : orderId,
    orderStatus: raw.order_status != null ? String(raw.order_status) : null,
    httpStatus: ok ? 200 : verifyRes.status >= 400 ? verifyRes.status : 422,
    upstream: raw,
  };
}

export function slipApiBase(): string {
  return SLIP_API_BASE;
}

/** Parse a data-URL or raw base64 image into a Blob for upstream upload. */
export function slipImageToBlob(dataUrlOrBase64: string, mimeHint?: string): { blob: Blob; fileName: string } | null {
  const raw = (dataUrlOrBase64 || "").trim();
  if (!raw) return null;
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
  let mime = mimeHint || "image/png";
  let b64: string;
  let ext = "png";
  if (m) {
    mime = m[1].toLowerCase();
    ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    b64 = m[3];
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 64) {
    b64 = raw;
    if (mimeHint?.includes("jpeg") || mimeHint?.includes("jpg")) ext = "jpg";
    else if (mimeHint?.includes("webp")) ext = "webp";
    else if (mimeHint?.includes("gif")) ext = "gif";
  } else {
    return null;
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength < 32 || buf.byteLength > 5 * 1024 * 1024) return null;
  return {
    blob: new Blob([new Uint8Array(buf)], { type: mime }),
    fileName: `slip.${ext}`,
  };
}

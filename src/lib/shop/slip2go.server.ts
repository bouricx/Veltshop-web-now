/** Official REST contract: https://slip2go.com/guide/rest-api/image */
import { promptPayAccount } from "./payment-policy.ts";
const OFFICIAL_VERIFY_URL = "https://connect.slip2go.com/api/verify-slip/qr-image/info";
export type SlipResult = {
  ok: boolean;
  amount: number | null;
  reference: string | null;
  transferredAt?: number | null;
  review?: boolean;
  reason: string;
};
function verifyUrl() {
  const url = new URL(process.env.SLIP2GO_VERIFY_URL?.trim() || OFFICIAL_VERIFY_URL);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "connect.slip2go.com" ||
    url.pathname !== "/api/verify-slip/qr-image/info" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid Slip2Go endpoint");
  return url;
}
export function slip2GoConfigured() {
  try {
    return Boolean(process.env.SLIP2GO_API_SECRET?.trim() && verifyUrl());
  } catch {
    return false;
  }
}
export async function verifySlip2Go(
  file: Blob,
  fileName: string,
  amount: number,
  receiver: string,
): Promise<SlipResult> {
  const secret = process.env.SLIP2GO_API_SECRET?.trim();
  if (!secret)
    return {
      ok: false,
      amount: null,
      reference: null,
      review: true,
      reason: "ยังไม่ได้ตั้งค่าบริการตรวจสลิป",
    };
  const url = verifyUrl();
  const account = promptPayAccount(receiver);
  if (!account)
    return {
      ok: false,
      amount: null,
      reference: null,
      review: true,
      reason: "กรุณาตรวจสอบบัญชีรับเงินของร้าน",
    };
  const form = new FormData();
  form.set("file", file, fileName);
  form.set(
    "payload",
    JSON.stringify({
      checkDuplicate: true,
      checkReceiver: [{ accountType: account.accountType, accountNumber: account.number }],
      checkAmount: { type: "eq", amount: String(amount) },
      checkDate: { type: "gte", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    }),
  );
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: secret },
    body: form,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  let body: {
    code?: string;
    data?: { amount?: number; transRef?: string; dateTime?: string };
  };
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      amount: null,
      reference: null,
      review: true,
      reason: "บริการตรวจสลิปไม่ตอบกลับ กรุณารอแอดมินตรวจสอบ",
    };
  }
  if (!body || typeof body !== "object")
    return {
      ok: false,
      amount: null,
      reference: null,
      review: true,
      reason: "บริการตรวจสลิปไม่ตอบกลับ กรุณารอแอดมินตรวจสอบ",
    };
  const transferredAt = Date.parse(body.data?.dateTime ?? "");
  const reference = body.data?.transRef;
  // HTTP 200 also carries failed verification codes; only conditions-valid is accepted.
  const ok =
    response.ok &&
    body.code === "200200" &&
    body.data?.amount === amount &&
    typeof reference === "string" &&
    reference.length > 0 &&
    reference.length <= 200 &&
    Number.isFinite(transferredAt) &&
    transferredAt <= Date.now() + 60000 &&
    transferredAt >= Date.now() - 24 * 60 * 60 * 1000;
  const reasons: Record<string, string> = {
    "200401": "บัญชีผู้รับไม่ตรงกับบัญชีร้าน",
    "200402": "ยอดเงินไม่ตรงกับยอดสั่งซื้อ",
    "200403": "วันที่โอนไม่ตรงตามเงื่อนไข",
    "200404": "ยังไม่พบสลิปในระบบธนาคาร กรุณารอแอดมินตรวจสอบ",
    "200500": "ธนาคารไม่ยืนยันความถูกต้องของสลิปนี้",
    "200501": "สลิปนี้ถูกใช้ไปแล้ว",
    "200502": "ธนาคารขัดข้อง กรุณารอแอดมินตรวจสอบ",
    "400001": "ไม่พบ QR บนสลิป กรุณาใช้สลิปจากแอปธนาคาร",
    "400002": "ไฟล์สลิปไม่ถูกต้อง กรุณาเลือกภาพใหม่",
  };
  const review =
    !ok &&
    (response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      response.status >= 500 ||
      ["200404", "200502"].includes(body.code ?? "") ||
      !reasons[body.code ?? ""]);
  return {
    ok,
    amount: ok ? amount : null,
    reference: ok ? reference! : null,
    transferredAt: ok ? transferredAt : null,
    review,
    reason: ok
      ? "ตรวจสลิปผ่าน"
      : reasons[body.code ?? ""] || "บริการตรวจสลิปยังยืนยันไม่ได้ กรุณารอแอดมินตรวจสอบ",
  };
}

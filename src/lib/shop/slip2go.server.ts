/** Official REST contract: https://slip2go.com/guide/rest-api/image */
export type SlipResult = {
  ok: boolean;
  amount: number | null;
  reference: string | null;
  reason: string;
};
export async function verifySlip2Go(
  file: Blob,
  fileName: string,
  amount: number,
  receiver: string,
): Promise<SlipResult> {
  const secret = process.env.SLIP2GO_API_SECRET?.trim();
  const endpoint = process.env.SLIP2GO_VERIFY_URL?.trim();
  if (!secret || !endpoint)
    return { ok: false, amount: null, reference: null, reason: "ยังไม่ได้ตั้งค่าบริการตรวจสลิป" };
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    !["slip2go.com", "www.slip2go.com", "connect.slip2go.com"].includes(url.hostname) ||
    url.pathname !== "/api/verify-slip/qr-image/info" ||
    url.username ||
    url.password
  )
    throw new Error("Invalid Slip2Go endpoint");
  const form = new FormData();
  form.set("file", file, fileName);
  form.set(
    "payload",
    JSON.stringify({
      checkDuplicate: true,
      checkReceiver: [{ accountType: "02001", accountNumber: receiver }],
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
  });
  const body = (await response.json()) as {
    code?: string;
    data?: { amount?: number; transRef?: string; dateTime?: string };
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
  return {
    ok,
    amount: ok ? amount : null,
    reference: ok ? reference! : null,
    reason: ok ? "ตรวจสลิปผ่าน" : "ตรวจสลิปไม่ผ่านหรือข้อมูลไม่ครบ กรุณาติดต่อทีมงาน",
  };
}

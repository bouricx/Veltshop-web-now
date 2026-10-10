import { createHash } from "node:crypto";
/** Official REST API: https://resend.com/docs/api-reference/emails/send-email */
export async function sendAuthEmail(email: string, subject: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("บริการอีเมลยังไม่ได้ตั้งค่า");
  const target = new URL(url);
  if (process.env.BETTER_AUTH_URL && target.origin !== new URL(process.env.BETTER_AUTH_URL).origin)
    throw new Error("Invalid auth mail origin");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": createHash("sha256")
        .update(email)
        .update(subject)
        .update(url)
        .digest("hex"),
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `${subject}\n\n${url}\n\nหากคุณไม่ได้ทำรายการนี้ กรุณาไม่เปิดลิงก์นี้`,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("ส่งอีเมลไม่สำเร็จ");
}

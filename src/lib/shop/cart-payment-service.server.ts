import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { audit, notify } from "./operations-service.server.ts";
import { paymentProviders } from "./payment-providers.server.ts";
import { slipImageToBlob } from "./slip-verify-upstream.server.ts";

export async function verifyCartRequestSlip(
  sql: Sql,
  userId: string,
  requestId: string,
  dataUrl: string,
  mime?: string,
) {
  const parsed = slipImageToBlob(dataUrl, mime);
  if (!parsed) return { ok: false as const, message: "ไฟล์สลิปไม่ถูกต้องหรือมีขนาดเกิน 5 MB" };

  const [request] = await sql.query<{
    total: number;
    status: string;
    payment_status: string;
    receive_account: string;
    receive_name: string;
  }>(
    `SELECT r.total,r.status,p.status AS payment_status,s.receive_account,s.receive_name
     FROM cart_requests r
     JOIN cart_request_payments p ON p.cart_request_id=r.id
     JOIN shop_settings s ON s.id=1
     WHERE r.id=$1 AND r.user_id=$2`,
    [requestId, userId],
  );
  if (!request) return { ok: false as const, message: "ไม่พบรายการสั่งซื้อ" };
  if (request.status === "cancelled") return { ok: false as const, message: "รายการนี้ถูกยกเลิกแล้ว" };
  if (request.payment_status === "paid") return { ok: true as const, status: "paid", message: "รายการนี้ชำระแล้ว" };

  const bytes = Buffer.from(await parsed.blob.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const [duplicate] = await sql.query<{ id: string }>(
    `SELECT id FROM payments WHERE slip_hash=$1
     UNION ALL
     SELECT cart_request_id AS id FROM cart_request_payments
       WHERE slip_hash=$1 AND cart_request_id<>$2 LIMIT 1`,
    [hash, requestId],
  );
  if (duplicate) return { ok: false as const, message: "สลิปนี้เคยใช้ชำระแล้ว" };

  await sql.query(
    `UPDATE cart_request_payments SET status='verifying',slip_hash=$2,slip_evidence=$3,reject_reason=NULL
     WHERE cart_request_id=$1 AND user_id=$4 AND status <> 'paid'`,
    [requestId, hash, dataUrl, userId],
  );

  let result;
  try {
    result = await paymentProviders.promptpay.verify({
      file: new Blob([new Uint8Array(bytes)], { type: parsed.blob.type || "image/png" }),
      fileName: parsed.fileName,
      amount: Number(request.total),
      receiver: request.receive_account,
    });
  } catch {
    result = {
      ok: false,
      amount: null,
      reference: null,
      reason: "เชื่อมต่อบริการตรวจสลิปไม่สำเร็จ",
    };
  }

  if (!result.ok || result.amount !== Number(request.total) || !result.reference) {
    const manual =
      result.reason.includes("ยังไม่ได้ตั้งค่าบริการตรวจสลิป") ||
      result.reason.includes("เชื่อมต่อบริการตรวจสลิปไม่สำเร็จ");
    const reason = result.reason || "ยอดหรือผู้รับเงินไม่ตรงกับรายการ";
    await sql.query(
      `UPDATE cart_request_payments SET status=$2,reject_reason=$3
       WHERE cart_request_id=$1 AND status='verifying'`,
      [requestId, manual ? "manual_review" : "rejected", reason],
    );
    return {
      ok: false as const,
      status: manual ? ("manual_review" as const) : ("rejected" as const),
      pending: manual,
      message: manual
        ? "รับสลิปแล้ว แต่ยังยืนยันการจ่ายไม่ได้ กรุณาติดต่อร้านเพื่อตรวจด้วยตนเอง"
        : `ตรวจสลิปไม่ผ่าน: ${reason}`,
    };
  }

  try {
    await sql.transaction(async (tx) => {
      const [payment] = await tx.query<{ status: string; amount: number }>(
        "SELECT status,amount FROM cart_request_payments WHERE cart_request_id=$1 AND user_id=$2 FOR UPDATE",
        [requestId, userId],
      );
      if (!payment || payment.status !== "verifying" || Number(payment.amount) !== Number(request.total))
        throw new CommerceError("สถานะชำระเงินเปลี่ยนแล้ว กรุณาโหลดรายการใหม่");
      await tx.query(
        `INSERT INTO transactions(id,user_id,kind,status,amount,provider,provider_ref)
         VALUES($1,$2,'CART_PAYMENT','success',$3,'slip2go',$4)`,
        [randomUUID(), userId, request.total, result.reference],
      );
      await tx.query(
        `UPDATE cart_request_payments SET status='paid',provider_reference=$2,reject_reason=NULL,verified_at=now()
         WHERE cart_request_id=$1`,
        [requestId, result.reference],
      );
      await audit(tx, userId, "cart.payment_verified", "cart_request", requestId, {
        amount: request.total,
        provider: "slip2go",
      });
      await notify(
        tx,
        userId,
        "ตรวจสอบการชำระเงินสำเร็จ",
        `รายการ ${requestId} · ยอด ${request.total} บาท · ร้านจะตรวจรายการและดำเนินการจัดส่ง โดยปกติใช้เวลา 5–10 นาที`,
      );
    });
    return {
      ok: true as const,
      status: "paid",
      message: `ตรวจสลิปผ่านแล้ว · ยอด ${request.total} บาท · ร้านจะดำเนินการจัดส่งภายใน 5–10 นาที`,
    };
  } catch (error) {
    const duplicateReference = error instanceof Error && /transactions_provider_ref_idx/.test(error.message);
    const message = duplicateReference
      ? "เลขอ้างอิงโอนนี้เคยใช้แล้ว"
      : error instanceof CommerceError
        ? error.message
        : "ตรวจพบสลิปแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาติดต่อร้านก่อนส่งซ้ำ";
    await sql.query(
      `UPDATE cart_request_payments SET status='rejected',reject_reason=$2
       WHERE cart_request_id=$1 AND status='verifying'`,
      [requestId, message],
    );
    return { ok: false as const, message };
  }
}

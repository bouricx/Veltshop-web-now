import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { audit, notify } from "./operations-service.server.ts";
import { paymentProviders } from "./payment-providers.server.ts";
import { slipImageToBlob } from "./slip-verify-upstream.server.ts";
import { MAX_SLIP_BYTES } from "./payment-policy.ts";
import { refreshCartPaymentStates } from "./checkout-service.server.ts";

export async function verifyCartRequestSlip(
  sql: Sql,
  userId: string,
  requestId: string,
  dataUrl: string,
  mime?: string,
) {
  const parsed = slipImageToBlob(dataUrl, mime);
  if (
    !parsed ||
    parsed.blob.size > MAX_SLIP_BYTES ||
    !["image/png", "image/jpeg", "image/webp"].includes(parsed.blob.type)
  )
    return { ok: false as const, message: "กรุณาใช้ภาพ PNG, JPG หรือ WebP ขนาดไม่เกิน 3 MB" };
  await refreshCartPaymentStates(sql, userId);

  const [request] = await sql.query<{
    total: number;
    status: string;
    payment_status: string;
    created_at: string;
    expires_at: string;
    receive_account: string;
    receive_name: string;
  }>(
    `SELECT r.total,r.status,p.status AS payment_status,p.created_at::text,p.expires_at::text,p.receive_account,p.receive_name
     FROM cart_requests r
     JOIN cart_request_payments p ON p.cart_request_id=r.id
     WHERE r.id=$1 AND r.user_id=$2`,
    [requestId, userId],
  );
  if (!request) return { ok: false as const, message: "ไม่พบรายการสั่งซื้อ" };
  if (request.status === "cancelled")
    return { ok: false as const, message: "รายการนี้ถูกยกเลิกแล้ว" };
  if (request.payment_status === "paid")
    return { ok: true as const, status: "paid", message: "รายการนี้ชำระแล้ว" };
  if (["verifying", "manual_review"].includes(request.payment_status))
    return {
      ok: false as const,
      status: request.payment_status,
      pending: true,
      message: "รับสลิปแล้ว กรุณารอผลตรวจโดยไม่ต้องโอนซ้ำ",
    };

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

  let claimed;
  try {
    [claimed] = await sql.query<{ cart_request_id: string }>(
      `UPDATE cart_request_payments SET status='verifying',slip_hash=$2,slip_evidence=$3,reject_reason=NULL
       ,submitted_at=now()
     WHERE cart_request_id=$1 AND user_id=$4 AND status IN ('unpaid','rejected','expired')
       AND EXISTS(SELECT 1 FROM cart_requests r WHERE r.id=$1 AND r.status<>'cancelled')
     RETURNING cart_request_id`,
      [requestId, hash, dataUrl, userId],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return { ok: false as const, message: "สลิปนี้ถูกใช้กับรายการอื่นแล้ว" };
    throw error;
  }
  if (!claimed)
    return { ok: false as const, message: "สถานะรายการเปลี่ยนแล้ว กรุณารอผลตรวจหรือโหลดใหม่" };

  async function manualReview(reason: string) {
    await sql.transaction(async (tx) => {
      const rows = await tx.query(
        `UPDATE cart_request_payments SET status='manual_review',reject_reason=$2
         WHERE cart_request_id=$1 AND status='verifying' RETURNING cart_request_id`,
        [requestId, reason],
      );
      if (rows.length) {
        await audit(tx, userId, "cart.payment_review", "cart_request", requestId);
        await tx.query(
          "INSERT INTO admin_events(kind,entity_id) VALUES('cart.payment_review',$1)",
          [requestId],
        );
      }
    });
    return {
      ok: false as const,
      status: "manual_review" as const,
      pending: true,
      message: "รับสลิปแล้ว · รอแอดมินตรวจยอดเงิน กรุณาอย่าโอนซ้ำ",
    };
  }
  // A banking QR cannot revoke an actual transfer. Preserve late evidence for the merchant.
  if (Date.now() >= Date.parse(request.expires_at))
    return manualReview("แนบสลิปหลังหมดเวลาชำระ กรุณาตรวจเวลาที่เงินเข้าบัญชีจริงก่อนอนุมัติ");

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
      review: true,
      reason: "เชื่อมต่อบริการตรวจสลิปไม่สำเร็จ",
    };
  }

  if (!result.ok || result.amount !== Number(request.total) || !result.reference) {
    const reason = result.reason || "ยอดหรือผู้รับเงินไม่ตรงกับรายการ";
    if (result.review) return manualReview(reason);
    await sql.query(
      `UPDATE cart_request_payments SET status=$2,reject_reason=$3
       WHERE cart_request_id=$1 AND status='verifying'`,
      [requestId, "rejected", reason],
    );
    return {
      ok: false as const,
      status: "rejected" as const,
      message: `ตรวจสลิปไม่ผ่าน: ${reason}`,
    };
  }

  if (
    !result.transferredAt ||
    result.transferredAt < Math.floor(Date.parse(request.created_at) / 1000) * 1000
  ) {
    const message = "สลิปนี้โอนก่อนสร้างรายการ กรุณาเลือกสลิปของรายการนี้";
    await sql.query(
      "UPDATE cart_request_payments SET status='rejected',reject_reason=$2 WHERE cart_request_id=$1 AND status='verifying'",
      [requestId, message],
    );
    return { ok: false as const, status: "rejected", message };
  }
  if (result.transferredAt > Date.parse(request.expires_at))
    return manualReview("รายการโอนเกิดหลังหมดเวลา กรุณาตรวจยอดเงินเข้าจริงก่อนอนุมัติ");

  try {
    await sql.transaction(async (tx) => {
      const [payment] = await tx.query<{ status: string; amount: number; order_status: string }>(
        `SELECT p.status,p.amount,r.status AS order_status FROM cart_request_payments p
         JOIN cart_requests r ON r.id=p.cart_request_id
         WHERE cart_request_id=$1 AND p.user_id=$2 FOR UPDATE OF p,r`,
        [requestId, userId],
      );
      if (
        !payment ||
        payment.status !== "verifying" ||
        payment.order_status === "cancelled" ||
        Number(payment.amount) !== Number(request.total)
      )
        throw new CommerceError("สถานะชำระเงินเปลี่ยนแล้ว กรุณาโหลดรายการใหม่");
      const [used] = await tx.query(
        `SELECT id FROM payments WHERE provider_reference=$1
         UNION ALL SELECT id FROM transactions WHERE provider IN ('slip2go','manual_bank') AND provider_ref=$1 LIMIT 1`,
        [result.reference],
      );
      if (used) throw new CommerceError("เลขอ้างอิงโอนนี้เคยใช้แล้ว");
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
      reference: result.reference,
      message: `ตรวจสลิปผ่านแล้ว · ยอด ${request.total} บาท · ร้านจะดำเนินการจัดส่งภายใน 5–10 นาที`,
    };
  } catch (error) {
    const duplicateReference = (error as { code?: string }).code === "23505";
    if (!duplicateReference && !(error instanceof CommerceError))
      return manualReview("ตรวจพบการโอน แต่บันทึกยืนยันไม่สำเร็จ กรุณาตรวจสอบก่อนอนุมัติ");
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
    return { ok: false as const, status: "rejected", message };
  }
}

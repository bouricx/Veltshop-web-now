import { randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { audit, notify } from "./operations-service.server.ts";

export async function reviewCartPayment(
  sql: Sql,
  actor: string,
  data: {
    id: string;
    decision: "approve" | "reject";
    reference?: string;
    reason?: string;
    expectedStatus: string;
    bankConfirmed?: boolean;
  },
) {
  if (data.decision === "approve" && data.bankConfirmed !== true)
    return { ok: false, message: "ตรวจยอดเงินเข้าจริงในบัญชีธนาคารและยืนยันก่อนอนุมัติ" };
  if (data.decision === "approve" && (!data.reference || data.reference.trim().length < 4))
    return { ok: false, message: "กรอกเลขอ้างอิงจากรายการโอนในบัญชีธนาคารก่อนอนุมัติ" };
  try {
    return await sql.transaction(async (tx) => {
      const [payment] = await tx.query<{ user_id: string; amount: number; status: string }>(
        `SELECT p.user_id,p.amount,p.status FROM cart_request_payments p
         JOIN cart_requests r ON r.id=p.cart_request_id
         WHERE p.cart_request_id=$1 AND r.status IN ('pending','received') FOR UPDATE OF p,r`,
        [data.id],
      );
      if (
        !payment ||
        payment.status !== data.expectedStatus ||
        !["unpaid", "rejected", "expired", "manual_review"].includes(payment.status)
      )
        return { ok: false, message: "สถานะรายการเปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนยืนยันยอดเงิน" };
      if (data.decision === "reject") {
        if (payment.status !== "manual_review")
          return { ok: false, message: "ไม่มีสลิปที่รอให้ปฏิเสธ" };
        const reason = data.reason || "แอดมินตรวจสลิปไม่ผ่าน";
        await tx.query(
          "UPDATE cart_request_payments SET status='rejected',reject_reason=$2 WHERE cart_request_id=$1",
          [data.id, reason],
        );
        await audit(tx, actor, "cart.payment_rejected", "cart_request", data.id, { reason });
        await notify(tx, payment.user_id, "ตรวจสลิปไม่ผ่าน", `รายการ ${data.id} · ${reason}`);
        return { ok: true, message: "ปฏิเสธสลิปแล้ว" };
      }
      const reference = data.reference!.trim();
      const [duplicate] = await tx.query<{ id: string }>(
        `SELECT id FROM transactions WHERE provider IN ('slip2go','manual_bank') AND provider_ref=$1
         UNION ALL SELECT id FROM payments WHERE provider_reference=$1 LIMIT 1`,
        [reference],
      );
      if (duplicate) return { ok: false, message: "เลขอ้างอิงนี้เคยใช้กับรายการอื่นแล้ว" };
      await tx.query(
        `INSERT INTO transactions(id,user_id,kind,status,amount,provider,provider_ref)
         VALUES($1,$2,'CART_PAYMENT','success',$3,'manual_bank',$4)`,
        [randomUUID(), payment.user_id, payment.amount, reference],
      );
      await tx.query(
        `UPDATE cart_request_payments SET status='paid',provider_reference=$2,reject_reason=NULL,verified_at=now()
         WHERE cart_request_id=$1`,
        [data.id, reference],
      );
      await audit(tx, actor, "cart.payment_manually_approved", "cart_request", data.id, {
        amount: payment.amount,
        reference,
      });
      await notify(
        tx,
        payment.user_id,
        "ตรวจสอบการชำระเงินสำเร็จ",
        `รายการ ${data.id} · ร้านจะดำเนินการจัดส่ง โดยปกติใช้เวลา 5–10 นาที`,
      );
      return { ok: true, message: "ยืนยันการชำระเงินแล้ว" };
    });
  } catch (error) {
    return {
      ok: false,
      message:
        (error as { code?: string }).code === "23505"
          ? "เลขอ้างอิงนี้เคยใช้กับรายการอื่นแล้ว"
          : "บันทึกผลตรวจไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

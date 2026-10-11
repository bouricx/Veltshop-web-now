import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { audit, limit, notify } from "./operations-service.server";
import { CommerceError } from "./commerce.server";
import { createCartRequest, type RequestItem } from "./cart-request-service.server";
import { verifyCartRequestSlip } from "./cart-payment-service.server";
export type { RequestItem } from "./cart-request-service.server";

export type CartRequest = {
  id: string;
  user_id: string;
  name?: string;
  email?: string;
  contact: string;
  note: string;
  items: RequestItem[];
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  payment_status: "unpaid" | "verifying" | "paid" | "rejected" | "manual_review";
  payment_reason: string | null;
};
const input = z
  .object({
    key: z.string().uuid(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(160),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(30),
    contact: z.string().trim().min(3).max(300),
    note: z.string().trim().max(2000).default(""),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    "สินค้าซ้ำในรายการ",
  );

export const submitCartRequest = createServerFn({ method: "POST" })
  .validator((v: unknown) => input.parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = String(context.userId);
    try {
      const sql = await getSql();
      await limit(sql, `cart-request:${user}`, 10);
      return await createCartRequest(sql, user, data);
    } catch (e) {
      return {
        ok: false as const,
        message:
          e instanceof CommerceError
            ? e.message
            : "ส่งรายการไม่สำเร็จ กรุณาลองอีกครั้ง รายการในตะกร้ายังอยู่",
      };
    }
  });

export const listMyCartRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    (await getSql()).query<CartRequest>(
      `SELECT r.id,r.user_id,r.contact,r.note,r.items,r.total,r.status,r.created_at::text,r.updated_at::text,
        p.status AS payment_status,p.reject_reason AS payment_reason
       FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
       WHERE r.user_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 30`,
      [String(context.userId)],
    ),
  );



export const getCartPaymentInfo = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const [row] = await sql.query<{
      amount: number;
      status: CartRequest["payment_status"];
      receive_account: string;
      receive_name: string;
    }>(
      `SELECT p.amount,p.status,s.receive_account,s.receive_name
       FROM cart_request_payments p JOIN shop_settings s ON s.id=1
       WHERE p.cart_request_id=$1 AND p.user_id=$2`,
      [data.id, String(context.userId)],
    );
    return row ?? null;
  });

export const submitCartPaymentSlip = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({
    id: z.string().uuid(),
    slipDataUrl: z.string().min(1).max(8_000_000),
    mime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const userId = String(context.userId);
    const sql = await getSql();
    try {
      await limit(sql, `cart-slip:${userId}`, 5, 300);
      return await verifyCartRequestSlip(sql, userId, data.id, data.slipDataUrl, data.mime);
    } catch (error) {
      return { ok: false as const, message: error instanceof CommerceError ? error.message : "ตรวจสลิปไม่สำเร็จ กรุณาลองใหม่หรือแจ้งร้าน" };
    }
  });

export const getCartPaymentEvidence = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "orders.manage", context.bearerToken);
    const [row] = await (await getSql()).query<{ slip_evidence: string | null }>(
      "SELECT slip_evidence FROM cart_request_payments WHERE cart_request_id=$1 AND status='manual_review'",
      [data.id],
    );
    return row?.slip_evidence ?? null;
  });

export const resolveManualCartPayment = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approve", "reject"]),
      reference: z.string().trim().max(200).optional(),
      reason: z.string().trim().max(300).optional(),
    }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = String(context.userId);
    await requirePermission(actor, "orders.manage", context.bearerToken);
    if (data.decision === "approve" && (!data.reference || data.reference.length < 4))
      return { ok: false, message: "กรอกเลขอ้างอิงจากรายการโอนในบัญชีธนาคารก่อนอนุมัติ" };
    const sql = await getSql();
    return sql.transaction(async (tx) => {
      const [payment] = await tx.query<{ user_id: string; amount: number; status: string }>(
        `SELECT p.user_id,p.amount,p.status FROM cart_request_payments p
         JOIN cart_requests r ON r.id=p.cart_request_id
         WHERE p.cart_request_id=$1 AND r.status<>'cancelled' FOR UPDATE OF p,r`,
        [data.id],
      );
      if (!payment || payment.status !== "manual_review")
        return { ok: false, message: "รายการไม่อยู่ในสถานะรอตรวจโดยแอดมินแล้ว" };
      if (data.decision === "reject") {
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
        "SELECT id FROM transactions WHERE provider='slip2go' AND provider_ref=$1",
        [reference],
      );
      if (duplicate) return { ok: false, message: "เลขอ้างอิงนี้เคยใช้กับรายการอื่นแล้ว" };
      await tx.query(
        `INSERT INTO transactions(id,user_id,kind,status,amount,provider,provider_ref)
         VALUES($1,$2,'CART_PAYMENT','success',$3,'slip2go',$4)`,
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
  });

export const listAdminCartRequests = createServerFn({ method: "GET" })
  .validator((v: unknown) =>
    z
      .object({
        status: z.enum(["", "pending", "received", "done", "cancelled"]).default(""),
        page: z.number().int().min(0).max(100000).default(0),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "orders.manage", context.bearerToken);
    const sql = await getSql();
    const rows = await sql.query<CartRequest>(
      `SELECT r.id,r.user_id,u.name,u.email,r.contact,r.note,r.items,r.total,r.status,r.created_at::text,r.updated_at::text,
        p.status AS payment_status,p.reject_reason AS payment_reason
       FROM cart_requests r JOIN "user" u ON u.id=r.user_id
       JOIN cart_request_payments p ON p.cart_request_id=r.id
       WHERE $1='' OR r.status=$1 ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET $2`,
      [data.status, data.page * 30],
    );
    const [count] = await sql.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM cart_requests WHERE $1='' OR status=$1",
      [data.status],
    );
    return { rows, total: count.total };
  });

export const updateCartRequest = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        expectedStatus: z.enum(["pending", "received", "done", "cancelled"]),
        status: z.enum(["received", "done", "cancelled"]),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = String(context.userId);
    await requirePermission(actor, "orders.manage", context.bearerToken);
    return (await getSql()).transaction(async (tx) => {
      const [row] = await tx.query<{ user_id: string; status: string; payment_status: string }>(
        `SELECT r.user_id,r.status,p.status AS payment_status
         FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
         WHERE r.id=$1 FOR UPDATE OF r,p`,
        [data.id],
      );
      if (!row || row.status !== data.expectedStatus || ["done", "cancelled"].includes(row.status))
        return { ok: false, message: "รายการเปลี่ยนสถานะแล้ว กรุณาโหลดใหม่" };
      if (data.status !== "cancelled" && row.payment_status !== "paid")
        return { ok: false, message: "ยังจัดการรายการไม่ได้ เพราะยังไม่ยืนยันการชำระเงิน" };
      await tx.query("UPDATE cart_requests SET status=$2,updated_at=now() WHERE id=$1", [
        data.id,
        data.status,
      ]);
      await audit(tx, actor, "cart.status_changed", "cart_request", data.id, {
        from: row.status,
        to: data.status,
      });
      const label = {
        received: "ร้านรับเรื่องแล้ว",
        done: "ร้านจัดการรายการแล้ว",
        cancelled: "รายการถูกยกเลิก",
      }[data.status];
      await notify(
        tx,
        row.user_id,
        label,
        `เลขรายการ ${data.id} · สถานะรายการอัปเดตแล้ว`,
      );
      return { ok: true, message: label };
    });
  });

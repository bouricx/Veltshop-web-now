import { quoteCart } from "./cart-quote.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { limit } from "./operations-service.server";
import { CommerceError } from "./commerce.server";
import { createCartRequest, type RequestItem } from "./cart-request-service.server";
import { changeCartRequestStatus } from "./cart-status-service.server";
import { reviewCartPayment } from "./cart-payment-review.server";
import { verifyCartRequestSlip } from "./cart-payment-service.server";
import { checkoutReadiness, refreshCartPaymentStates } from "./checkout-service.server";
import {
  fulfillCartRequest,
  readCartDelivery,
  type DeliveryChannel,
} from "./cart-delivery-service.server";
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
  payment_status: "unpaid" | "verifying" | "paid" | "rejected" | "manual_review" | "expired";
  payment_reason: string | null;
  delivery_channel: DeliveryChannel | null;
  delivered_at: string | null;
  has_delivery: boolean;
};
const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int(),
        price: z.number().int(),
        lineTotal: z.number().int(),
        warrantyDays: z.number().int(),
      }),
    )
    .max(30),
  subtotal: z.number().int(),
  discount: z.number().int(),
  total: z.number().int(),
  coupon: z.string().max(128),
});
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
    coupon: z.string().trim().max(128).default(""),
    acceptedQuote: quoteSchema,
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

export const getCartQuote = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        items: z
          .array(
            z.object({
              productId: z.string().min(1).max(160),
              quantity: z.number().int().min(1).max(99),
            }),
          )
          .min(1)
          .max(30),
        coupon: z.string().trim().max(128).default(""),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await limit(sql, `cart-quote:${context.userId}`, 60);
    try {
      return {
        ok: true as const,
        quote: await sql.transaction((tx) =>
          quoteCart(tx, String(context.userId), data.items, data.coupon),
        ),
      };
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof CommerceError ? e.message : "ตรวจยอดไม่สำเร็จ กรุณาลองใหม่",
      };
    }
  });

export const getCheckoutReadiness = createServerFn({ method: "GET" }).handler(async () =>
  checkoutReadiness(await getSql()),
);

export const listMyCartRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await refreshCartPaymentStates(sql, String(context.userId));
    return sql.query<CartRequest>(
      `SELECT r.id,r.user_id,r.contact,r.note,r.items,r.total,r.status,r.created_at::text,r.updated_at::text,
        p.status AS payment_status,p.reject_reason AS payment_reason,r.delivery_channel,r.delivered_at::text,
        (r.delivery_ciphertext IS NOT NULL) AS has_delivery
       FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
       WHERE r.user_id=$1 ORDER BY r.updated_at DESC,r.id LIMIT 30`,
      [String(context.userId)],
    );
  });

export const getCartPaymentInfo = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await refreshCartPaymentStates(sql, String(context.userId));
    const [row] = await sql.query<{
      amount: number;
      status: CartRequest["payment_status"];
      receive_account: string;
      receive_name: string;
      expires_at: string;
      order_status: string;
      reject_reason: string | null;
    }>(
      `SELECT p.amount,p.status,p.receive_account,p.receive_name,p.expires_at::text,p.reject_reason,r.status AS order_status
       FROM cart_request_payments p JOIN cart_requests r ON r.id=p.cart_request_id
       WHERE p.cart_request_id=$1 AND p.user_id=$2`,
      [data.id, String(context.userId)],
    );
    return row ? { ...row, ...(await checkoutReadiness(sql)), server_time: Date.now() } : null;
  });

export const submitCartPaymentSlip = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        slipDataUrl: z.string().min(1).max(4_200_000),
        mime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const userId = String(context.userId);
    const sql = await getSql();
    try {
      await limit(sql, `cart-slip:${userId}`, 5, 300);
      return await verifyCartRequestSlip(sql, userId, data.id, data.slipDataUrl, data.mime);
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof CommerceError
            ? error.message
            : "ตรวจสลิปไม่สำเร็จ กรุณาลองใหม่หรือแจ้งร้าน",
      };
    }
  });

export const getAdminCartPaymentReview = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "orders.manage", context.bearerToken);
    const [row] = await (
      await getSql()
    ).query<{
      slip_evidence: string | null;
      receive_account: string;
      receive_name: string;
      amount: number;
    }>(
      "SELECT slip_evidence,receive_account,receive_name,amount FROM cart_request_payments WHERE cart_request_id=$1",
      [data.id],
    );
    return row ?? null;
  });

export const resolveManualCartPayment = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        reference: z.string().trim().max(200).optional(),
        reason: z.string().trim().max(300).optional(),
        expectedStatus: z.enum(["unpaid", "rejected", "expired", "manual_review"]),
        bankConfirmed: z.boolean().default(false),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = String(context.userId);
    await requirePermission(actor, "orders.manage", context.bearerToken);
    return reviewCartPayment(await getSql(), actor, data);
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
    await refreshCartPaymentStates(sql);
    const rows = await sql.query<CartRequest>(
      `SELECT r.id,r.user_id,u.name,u.email,r.contact,r.note,r.items,r.total,r.status,r.created_at::text,r.updated_at::text,
        p.status AS payment_status,p.reject_reason AS payment_reason,r.delivery_channel,r.delivered_at::text,
        (r.delivery_ciphertext IS NOT NULL) AS has_delivery
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
    return changeCartRequestStatus(await getSql(), actor, data);
  });

export const deliverCartRequest = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        expectedStatus: z.enum(["pending", "received"]),
        channel: z.enum(["web", "facebook", "discord"]),
        entries: z
          .array(
            z.object({
              productId: z.string().min(1).max(160),
              payload: z.string().trim().max(10000),
              instructions: z.string().trim().max(10000).optional(),
            }),
          )
          .max(30),
        confirmedDelivered: z.literal(true),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = String(context.userId);
    await requirePermission(actor, "orders.manage", context.bearerToken);
    return fulfillCartRequest(await getSql(), actor, data);
  });

export const getMyCartDelivery = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    return readCartDelivery(await getSql(), String(context.userId), data.id);
  });

export const getAdminCartDelivery = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "orders.manage", context.bearerToken);
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const sql = await getSql();
    const [r] = await sql.query<{ user_id: string }>(
      "SELECT user_id FROM cart_requests WHERE id=$1",
      [data.id],
    );
    if (!r) return null;
    const result = await readCartDelivery(sql, r.user_id, data.id);
    if (result) {
      const { audit } = await import("./operations-service.server");
      await audit(sql, String(context.userId), "cart.delivery_viewed", "cart_request", data.id);
    }
    return result;
  });

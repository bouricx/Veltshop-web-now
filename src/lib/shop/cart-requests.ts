import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { audit, limit, notify } from "./operations-service.server";
import { CommerceError } from "./commerce.server";
import { createCartRequest, type RequestItem } from "./cart-request-service.server";
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
      "SELECT id,user_id,contact,note,items,total,status,created_at::text,updated_at::text FROM cart_requests WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 30",
      [String(context.userId)],
    ),
  );

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
      "SELECT r.id,r.user_id,u.name,u.email,r.contact,r.note,r.items,r.total,r.status,r.created_at::text,r.updated_at::text FROM cart_requests r JOIN \"user\" u ON u.id=r.user_id WHERE $1='' OR r.status=$1 ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET $2",
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
      const [row] = await tx.query<{ user_id: string; status: string }>(
        "SELECT user_id,status FROM cart_requests WHERE id=$1 FOR UPDATE",
        [data.id],
      );
      if (!row || row.status !== data.expectedStatus || ["done", "cancelled"].includes(row.status))
        return { ok: false, message: "รายการเปลี่ยนสถานะแล้ว กรุณาโหลดใหม่" };
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
        `เลขรายการ ${data.id} · ติดต่อร้านเพื่อยืนยันการชำระและการจัดส่ง`,
      );
      return { ok: true, message: label };
    });
  });

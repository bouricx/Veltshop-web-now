import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireAdmin } from "./require-admin.server";
import { addInventoryItem, readOwnedDelivery } from "./inventory-service.server";

const productId = z.string().trim().min(1).max(160);
export const addDigitalInventory = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z.object({ productId, payload: z.string().trim().min(1).max(20000) }).parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = await requireAdmin(context.bearerToken, "stock.manage");
    return addInventoryItem(await getSql(), actor.id, data.productId, data.payload);
  });
export const listDigitalInventory = createServerFn({ method: "GET" })
  .validator((value: unknown) => z.object({ productId }).parse(value))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(context.bearerToken, "stock.manage");
    const sql = await getSql();
    // No plaintext, fingerprint or encrypted payload leaves the metadata endpoint.
    return sql<{ id: string; status: string; order_id: string | null; created_at: string }>`
      SELECT id,status,order_id,created_at::text AS created_at FROM inventory_items
      WHERE product_id=${data.productId} ORDER BY created_at DESC LIMIT 100`;
  });
export const getMyDelivery = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    z.object({ orderId: z.string().trim().min(1).max(160) }).parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const payload = await readOwnedDelivery(await getSql(), String(context.userId), data.orderId);
    return payload === null
      ? { ok: false as const, message: "ยังไม่มีสินค้าจัดส่งสำหรับคำสั่งซื้อนี้" }
      : { ok: true as const, payload };
  });

export const importDigitalInventory = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({ productId, payloads: z.array(z.string().trim().min(1).max(20000)).min(1).max(200) })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = await requireAdmin(context.bearerToken, "stock.manage");
    const sql = await getSql();
    if (new Set(data.payloads).size !== data.payloads.length)
      return { ok: false as const, message: "ข้อมูลซ้ำในไฟล์นำเข้า" };
    return sql.transaction(async (tx) => {
      const adapter = Object.assign(tx, {
        transaction: async <T>(work: (tx: typeof sql) => Promise<T>) => work(tx),
      });
      for (let i = 0; i < data.payloads.length; i++) {
        const result = await addInventoryItem(adapter, actor.id, data.productId, data.payloads[i]);
        if (!result.ok) throw new Error(`รายการที่ ${i + 1} ซ้ำในสต็อก`);
      }
      return { ok: true as const, message: `เพิ่ม ${data.payloads.length} ชิ้นแล้ว` };
    });
  });

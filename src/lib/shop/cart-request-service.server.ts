import type { Sql } from "../db";
import { audit, configuration, notify } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";
import { createHash, randomUUID } from "node:crypto";
export type RequestItem = {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
};
export type CartRequestInput = {
  key: string;
  items: { productId: string; quantity: number }[];
  contact: string;
  note: string;
};
export async function createCartRequest(sql: Sql, user: string, data: CartRequestInput) {
  return await sql.transaction(async (tx) => {
    await tx.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...data,
          items: [...data.items].sort((a, b) => a.productId.localeCompare(b.productId)),
        }),
      )
      .digest("hex");
    const [previous] = await tx.query<{ id: string; fingerprint: string; total: number }>(
      "SELECT id,fingerprint,total FROM cart_requests WHERE user_id=$1 AND idempotency_key=$2",
      [user, data.key],
    );
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new CommerceError("คำขอซ้ำมีรายการต่างจากเดิม กรุณารีเฟรชหน้า");
      return { ok: true as const, id: previous.id, total: previous.total };
    }
    if ((await configuration(tx)).maintenance)
      throw new CommerceError("ร้านกำลังปรับปรุง กรุณาลองใหม่ภายหลัง");
    const [member] = await tx.query<{ disabled: boolean }>(
      "SELECT disabled FROM member_profiles WHERE user_id=$1",
      [user],
    );
    if (member?.disabled) throw new CommerceError("บัญชีถูกระงับ กรุณาติดต่อร้าน");
    const products = await tx.query<{
      id: string;
      name: string;
      category: string;
      price: number;
      stock: number;
      active: boolean;
    }>(
      "SELECT p.id,p.name,c.label AS category,p.price,p.stock,p.active FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=ANY($1::text[])",
      [data.items.map((i) => i.productId)],
    );
    const items: RequestItem[] = data.items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      if (!p || !p.active) throw new CommerceError("มีสินค้าที่ไม่ได้เปิดขาย กรุณานำออกจากตะกร้า");
      return {
        productId: p.id,
        name: p.name,
        category: p.category || "ไม่ระบุหมวดหมู่",
        price: Number(p.price),
        quantity: i.quantity,
      };
    });
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (!Number.isSafeInteger(total) || total > 2147483647)
      throw new CommerceError("ยอดรายการสูงเกินไป กรุณาลดจำนวนสินค้า");
    const id = randomUUID();
    await tx.query(
      "INSERT INTO cart_requests(id,user_id,idempotency_key,fingerprint,contact,note,items,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, user, data.key, fingerprint, data.contact, data.note, JSON.stringify(items), total],
    );
    await audit(tx, user, "cart.requested", "cart_request", id, { lines: items.length, total });
    await notify(
      tx,
      user,
      "ร้านได้รับรายการจากตะกร้าแล้ว",
      `เลขรายการ ${id} · ยังไม่มีการชำระเงินหรือจัดส่งสินค้า`,
    );
    return { ok: true as const, id, total };
  });
}

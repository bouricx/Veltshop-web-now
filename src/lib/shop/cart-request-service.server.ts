import type { Sql } from "../db";
import { audit, configuration, notify } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";
import { createHash, randomUUID } from "node:crypto";
import { checkoutReadiness } from "./checkout-service.server.ts";
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
    const readiness = await checkoutReadiness(tx);
    if (!readiness.available) throw new CommerceError(readiness.message);
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
      stock_mode: string;
    }>(
      "SELECT p.id,p.name,c.label AS category,p.price,p.stock,p.active,p.stock_mode FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=ANY($1::text[]) ORDER BY p.id FOR UPDATE OF p",
      [data.items.map((i) => i.productId)],
    );
    const reserved = await tx.query<{ product_id: string; quantity: number }>(
      `SELECT item->>'productId' AS product_id,sum((item->>'quantity')::int)::int AS quantity
       FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
       CROSS JOIN LATERAL jsonb_array_elements(r.items) item
       WHERE r.status IN ('pending','received') AND
         (p.status IN ('paid','verifying','manual_review') OR (p.status IN ('unpaid','rejected') AND p.expires_at>now()))
       AND item->>'productId'=ANY($1::text[]) GROUP BY item->>'productId'`,
      [data.items.map((i) => i.productId)],
    );
    const items: RequestItem[] = data.items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      if (!p || !p.active) throw new CommerceError("มีสินค้าที่ไม่ได้เปิดขาย กรุณานำออกจากตะกร้า");
      if (p.stock_mode !== "quantity")
        throw new CommerceError(
          `${p.name} ต้องให้ร้านยืนยันช่องทางจัดส่งก่อนชำระ กรุณาติดต่อแอดมิน`,
        );
      const available = Math.max(
        0,
        p.stock - (reserved.find((r) => r.product_id === p.id)?.quantity ?? 0),
      );
      if (available < i.quantity)
        throw new CommerceError(
          `${p.name} มีสต็อกยืนยันแล้ว ${available} ชิ้น กรุณาลดจำนวนหรือติดต่อร้านก่อนชำระเงิน`,
        );
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
    if (total < 1) throw new CommerceError("ยอดรายการต้องมากกว่า 0 บาท");
    const id = randomUUID();
    await tx.query(
      "INSERT INTO cart_requests(id,user_id,idempotency_key,fingerprint,contact,note,items,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, user, data.key, fingerprint, data.contact, data.note, JSON.stringify(items), total],
    );
    await tx.query(
      `INSERT INTO cart_request_payments(cart_request_id,user_id,amount,receive_account,receive_name)
       SELECT $1,$2,$3,receive_account,receive_name FROM shop_settings WHERE id=1`,
      [id, user, total],
    );
    await audit(tx, user, "cart.requested", "cart_request", id, { lines: items.length, total });
    await notify(
      tx,
      user,
      "สร้างรายการสั่งซื้อแล้ว",
      `เลขรายการ ${id} · ยอดชำระ ${total} บาท · ชำระภายใน 5 นาที แล้วแนบสลิปเพื่อตรวจสอบ`,
    );
    return { ok: true as const, id, total };
  });
}

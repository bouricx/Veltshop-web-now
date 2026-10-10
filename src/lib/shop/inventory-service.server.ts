import type { Sql } from "../db";
import { randomUUID } from "node:crypto";
import { encryptInventory, decryptInventory } from "./inventory-crypto.server.ts";
export async function addInventoryItem(
  sql: Sql,
  actorId: string,
  productId: string,
  payload: string,
) {
  const sealed = encryptInventory(productId, payload);
  return sql.transaction(async (tx) => {
    const products = await tx.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [productId]);
    if (!products.length) throw new Error("ไม่พบสินค้า");
    const id = randomUUID();
    const inserted = await tx.query(
      "INSERT INTO inventory_items(id,product_id,payload_ciphertext,payload_fingerprint) VALUES($1,$2,$3,$4) ON CONFLICT(product_id,payload_fingerprint) DO NOTHING RETURNING id",
      [id, productId, sealed.ciphertext, sealed.fingerprint],
    );
    if (!inserted.length)
      return { ok: false as const, message: "ข้อมูลสินค้าชิ้นนี้มีในสต็อกแล้ว" };
    await tx.query(
      "UPDATE products SET stock_mode='individual',stock=(SELECT count(*)::int FROM inventory_items WHERE product_id=$1 AND status='available'),updated_at=now() WHERE id=$1",
      [productId],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'inventory.added','inventory_item',$3,$4)",
      [randomUUID(), actorId, id, JSON.stringify({ productId })],
    );
    return { ok: true as const, inventoryId: id, message: "เพิ่มสต็อกจริงแล้ว" };
  });
}
export async function readOwnedDelivery(sql: Sql, userId: string, orderId: string) {
  const [override] = await sql.query<{ product_id: string; payload_ciphertext: string }>(
    "SELECT d.product_id,d.payload_ciphertext FROM order_deliveries d JOIN orders o ON o.id=d.order_id WHERE o.id=$1 AND o.user_id=$2 AND o.status='completed' ORDER BY d.created_at DESC,d.id DESC LIMIT 1",
    [orderId, userId],
  );
  if (override) return decryptInventory(override.product_id, override.payload_ciphertext);
  const [item] = await sql.query<{ product_id: string; payload_ciphertext: string }>(
    "SELECT i.product_id,i.payload_ciphertext FROM inventory_items i JOIN orders o ON o.id=i.order_id WHERE o.id=$1 AND o.user_id=$2 AND o.status='completed' AND i.status='sold'",
    [orderId, userId],
  );
  return item ? decryptInventory(item.product_id, item.payload_ciphertext) : null;
}

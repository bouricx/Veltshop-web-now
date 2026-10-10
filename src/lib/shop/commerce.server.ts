import { configurationSchema } from "./settings-schema.ts";
import { decryptInventory } from "./inventory-crypto.server.ts";
import type { Sql } from "../db";
import { randomUUID } from "node:crypto";

export class CommerceError extends Error {}

/** Locks the user's wallet first, serializing retries and concurrent spending. */
export async function purchase(
  sql: Sql,
  userId: string,
  productId: string,
  key: string,
  options: { free?: boolean; coupon?: string; customerInput?: string } = {},
) {
  return sql.transaction(async (tx) => {
    await tx.query("INSERT INTO wallet_accounts(user_id) VALUES ($1) ON CONFLICT DO NOTHING", [
      userId,
    ]);
    const [wallet] = await tx.query<{ balance: number }>(
      "SELECT balance FROM wallet_accounts WHERE user_id=$1 FOR UPDATE",
      [userId],
    );
    const [previous] = await tx.query<{ id: string; product_id: string; status: string }>(
      "SELECT o.id, i.product_id, o.status FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=$1 AND o.idempotency_key=$2",
      [userId, key],
    );
    if (previous) {
      if (previous.product_id !== productId) throw new CommerceError("คำขอซ้ำไม่ตรงกับสินค้าเดิม");
      return {
        orderId: previous.id,
        status: previous.status,
        balance: Number(wallet.balance),
        replay: true,
      };
    }
    const [settingsRow] = await tx.query<{ value: unknown }>(
      "SELECT value FROM site_configuration WHERE id=1",
    );
    const settings = configurationSchema.parse(settingsRow?.value ?? {});
    if (settings.maintenance) throw new CommerceError("ร้านกำลังปรับปรุง กรุณาลองใหม่ภายหลัง");
    let coupon:
      | {
          id: string;
          kind: string;
          amount: number;
          minimum: number;
          product_id: string | null;
          category_id: string | null;
          per_user_limit: number;
        }
      | undefined;
    if (options.coupon && !options.free) {
      [coupon] = await tx.query<typeof coupon>(
        "SELECT * FROM coupons WHERE code=$1 AND active=true AND (expires_at IS NULL OR expires_at>now()) AND used<usage_limit FOR UPDATE",
        [options.coupon.trim().toUpperCase()],
      );
      if (!coupon) throw new CommerceError("ส่วนลดไม่ถูกต้องหรือหมดอายุ");
      const [usage] = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM coupon_uses WHERE coupon_id=$1 AND user_id=$2",
        [coupon.id, userId],
      );
      if (usage.n >= coupon.per_user_limit) throw new CommerceError("คุณใช้ส่วนลดครบสิทธิ์แล้ว");
    }
    const [product] = await tx.query<{
      id: string;
      name: string;
      price: number;
      stock: number;
      stock_mode: string;
      category_id: string;
      warranty_days: number;
    }>(
      "SELECT id,name,price,stock,stock_mode,category_id,warranty_days FROM products WHERE id=$1 AND active=true FOR UPDATE",
      [productId],
    );
    if (!product || product.stock <= 0) throw new CommerceError("สินค้าหมดหรือปิดขายแล้ว");
    if (!Number.isSafeInteger(product.price) || product.price < 0)
      throw new CommerceError("ราคาสินค้าไม่ถูกต้อง");
    let total = options.free ? 0 : product.price;
    if (coupon) {
      if (
        product.price < coupon.minimum ||
        (coupon.product_id && coupon.product_id !== productId) ||
        (coupon.category_id && coupon.category_id !== product.category_id)
      )
        throw new CommerceError("ส่วนลดนี้ไม่ตรงกับสินค้า/ยอดขั้นต่ำ");
      total = Math.max(
        0,
        product.price -
          (coupon.kind === "percent"
            ? Math.floor((product.price * Math.min(100, coupon.amount)) / 100)
            : coupon.amount),
      );
    }
    if (wallet.balance < total) throw new CommerceError("เครดิตไม่เพียงพอ");
    let inventoryId: string | null = null;
    if (product.stock_mode === "individual") {
      const [item] = await tx.query<{ id: string; payload_ciphertext: string }>(
        "SELECT id,payload_ciphertext FROM inventory_items WHERE product_id=$1 AND status='available' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        [productId],
      );
      if (!item) throw new CommerceError("สินค้าหมด");
      // Validate decryption before any financial change; missing/wrong key rolls back.
      decryptInventory(productId, item.payload_ciphertext);
      inventoryId = item.id;
    }
    const status = inventoryId ? "completed" : "processing";
    const orderId = randomUUID();
    const balance = Number(wallet.balance) - total;
    await tx.query("UPDATE products SET stock=stock-1,updated_at=now() WHERE id=$1", [productId]);
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      userId,
      balance,
    ]);
    await tx.query(
      "INSERT INTO orders(id,user_id,status,subtotal,total,idempotency_key) VALUES($1,$2,$5,$3,$6,$4)",
      [orderId, userId, product.price, key, status, total],
    );
    await tx.query(
      "INSERT INTO order_items(id,order_id,product_id,product_name,unit_price,quantity,line_total) VALUES($1,$2,$3,$4,$5,1,$5)",
      [randomUUID(), orderId, productId, product.name, product.price],
    );
    await tx.query(
      "INSERT INTO inventory_movements(id,product_id,order_id,quantity,reason,actor_id) VALUES($1,$2,$3,-1,'purchase',$4)",
      [randomUUID(), productId, orderId, userId],
    );
    if (total > 0)
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,order_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,$5,'purchase')",
        [randomUUID(), userId, orderId, -total, balance],
      );
    await tx.query(
      "INSERT INTO transactions(id,user_id,order_id,kind,status,amount) VALUES($1,$2,$3,'PURCHASE','success',$4)",
      [randomUUID(), userId, orderId, total],
    );
    if (inventoryId) {
      await tx.query(
        "UPDATE inventory_items SET status='reserved',order_id=$2 WHERE id=$1 AND status='available'",
        [inventoryId, orderId],
      );
      await tx.query(
        "UPDATE inventory_items SET status='sold',sold_at=now() WHERE id=$1 AND order_id=$2 AND status='reserved'",
        [inventoryId, orderId],
      );
    }
    await tx.query(
      "UPDATE orders SET customer_input=$2,coupon_id=$3,warranty_end=CASE WHEN status='completed' AND $4>0 THEN now()+$4*interval '1 day' ELSE NULL END WHERE id=$1",
      [orderId, options.customerInput ?? "", coupon?.id ?? null, product.warranty_days],
    );
    if (coupon) {
      await tx.query("UPDATE coupons SET used=used+1 WHERE id=$1", [coupon.id]);
      await tx.query("INSERT INTO coupon_uses(coupon_id,order_id,user_id) VALUES($1,$2,$3)", [
        coupon.id,
        orderId,
        userId,
      ]);
    }
    await tx.query("INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,$3,$4)", [
      randomUUID(),
      userId,
      status === "completed" ? "จัดส่งสินค้าแล้ว" : "รับคำสั่งซื้อแล้ว",
      orderId,
    ]);
    return { orderId, status, balance, replay: false };
  });
}

/** Successful payment + balance + ledger commit together, or none commit. */
export async function creditVerifiedSlip(
  sql: Sql,
  input: {
    id: string;
    userId: string;
    amount: number;
    fee: number;
    credit: number;
    hash: string;
    provider?: string;
    reference?: string;
  },
) {
  return sql.transaction(async (tx) => {
    await tx.query("INSERT INTO wallet_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING", [
      input.userId,
    ]);
    const [wallet] = await tx.query<{ balance: number }>(
      "SELECT balance FROM wallet_accounts WHERE user_id=$1 FOR UPDATE",
      [input.userId],
    );
    const inserted = await tx.query(
      "INSERT INTO payments(id,method,amount,fee,credit,status,provider,slip_hash,user_id,provider_reference) VALUES($1,'slip',$2,$3,$4,'success',$7,$5,$6,$8) ON CONFLICT(id) DO UPDATE SET status='success',amount=excluded.amount,fee=excluded.fee,credit=excluded.credit,provider=excluded.provider,slip_hash=excluded.slip_hash,provider_reference=excluded.provider_reference WHERE payments.status IN ('pending','reconciliation_required') AND payments.user_id=excluded.user_id RETURNING id",
      [
        input.id,
        input.amount,
        input.fee,
        input.credit,
        input.hash,
        input.userId,
        input.provider ?? "slip-api-8787",
        input.reference ?? input.hash,
      ],
    );
    if (!inserted.length) throw new CommerceError("สลิปนี้เคยใช้แล้ว");
    if (input.reference) {
      const fence = await tx.query(
        "INSERT INTO transfer_references(reference,payment_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING reference",
        [input.reference, input.id],
      );
      if (!fence.length) throw new CommerceError("เลขอ้างอิงนี้เคยเติมเครดิตแล้ว");
    }
    const balance = Number(wallet.balance) + input.credit;
    if (!Number.isSafeInteger(balance) || balance > 2147483647)
      throw new CommerceError("ยอดเครดิตเกินขีดจำกัด");
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      input.userId,
      balance,
    ]);
    await tx.query(
      "INSERT INTO wallet_ledger(id,user_id,payment_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,$5,'topup')",
      [randomUUID(), input.userId, input.id, input.credit, balance],
    );
    await tx.query(
      "INSERT INTO transactions(id,user_id,payment_id,kind,status,amount,provider,provider_ref) VALUES($1,$2,$3,'TOPUP','success',$4,$6,$5)",
      [
        randomUUID(),
        input.userId,
        input.id,
        input.credit,
        input.reference ?? input.hash,
        input.provider ?? "slip-api-8787",
      ],
    );
    return balance;
  });
}

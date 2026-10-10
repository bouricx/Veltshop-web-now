import { decryptInventory } from "./inventory-crypto.server.ts";
import type { Sql } from "../db";
import { randomUUID } from "node:crypto";

export class CommerceError extends Error {}

/** Locks the user's wallet first, serializing retries and concurrent spending. */
export async function purchase(sql: Sql, userId: string, productId: string, key: string) {
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
    const [product] = await tx.query<{
      id: string;
      name: string;
      price: number;
      stock: number;
      stock_mode: string;
    }>(
      "SELECT id,name,price,stock,stock_mode FROM products WHERE id=$1 AND active=true FOR UPDATE",
      [productId],
    );
    if (!product || product.stock <= 0) throw new CommerceError("สินค้าหมดหรือปิดขายแล้ว");
    if (!Number.isSafeInteger(product.price) || product.price < 0)
      throw new CommerceError("ราคาสินค้าไม่ถูกต้อง");
    if (wallet.balance < product.price) throw new CommerceError("เครดิตไม่เพียงพอ");
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
    const balance = Number(wallet.balance) - product.price;
    await tx.query("UPDATE products SET stock=stock-1,updated_at=now() WHERE id=$1", [productId]);
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      userId,
      balance,
    ]);
    await tx.query(
      "INSERT INTO orders(id,user_id,status,subtotal,total,idempotency_key) VALUES($1,$2,$5,$3,$3,$4)",
      [orderId, userId, product.price, key, status],
    );
    await tx.query(
      "INSERT INTO order_items(id,order_id,product_id,product_name,unit_price,quantity,line_total) VALUES($1,$2,$3,$4,$5,1,$5)",
      [randomUUID(), orderId, productId, product.name, product.price],
    );
    await tx.query(
      "INSERT INTO inventory_movements(id,product_id,order_id,quantity,reason,actor_id) VALUES($1,$2,$3,-1,'purchase',$4)",
      [randomUUID(), productId, orderId, userId],
    );
    if (product.price > 0)
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,order_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,$5,'purchase')",
        [randomUUID(), userId, orderId, -product.price, balance],
      );
    await tx.query(
      "INSERT INTO transactions(id,user_id,order_id,kind,status,amount) VALUES($1,$2,$3,'PURCHASE','success',$4)",
      [randomUUID(), userId, orderId, product.price],
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
      "INSERT INTO payments(id,method,amount,fee,credit,status,provider,slip_hash,user_id,provider_reference) VALUES($1,'slip',$2,$3,$4,'success',$7,$5,$6,$8) ON CONFLICT DO NOTHING RETURNING id",
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

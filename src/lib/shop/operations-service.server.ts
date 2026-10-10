import { randomUUID, createHash } from "node:crypto";
import type { Sql } from "../db";
import { CommerceError, purchase } from "./commerce.server.ts";
import { encryptInventory } from "./inventory-crypto.server.ts";
import { configurationSchema } from "./settings-schema.ts";
export async function configuration(sql: Sql) {
  const [row] = await sql.query<{ value: unknown }>(
    "SELECT value FROM site_configuration WHERE id=1",
  );
  return configurationSchema.parse(row?.value ?? {});
}
export async function audit(
  sql: Sql,
  actor: string,
  action: string,
  entity: string,
  id: string,
  metadata: Record<string, unknown> = {},
) {
  await sql.query(
    "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), actor, action, entity, id, JSON.stringify(metadata)],
  );
}
export async function notify(sql: Sql, user: string, title: string, body = "") {
  await sql.query("INSERT INTO notifications(id,user_id,title,body) VALUES($1,$2,$3,$4)", [
    randomUUID(),
    user,
    title,
    body,
  ]);
}
export async function limit(sql: Sql, key: string, max = 20, seconds = 60) {
  const [row] = await sql.query<{ hits: number }>(
    `INSERT INTO request_limits(key,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits.expires_at<=now() THEN 1 ELSE request_limits.hits+1 END, expires_at=CASE WHEN request_limits.expires_at<=now() THEN excluded.expires_at ELSE request_limits.expires_at END RETURNING hits`,
    [key, seconds],
  );
  if (row.hits > max) throw new CommerceError("ทำรายการบ่อยเกินไป กรุณารอสักครู่");
}
async function wallet(sql: Sql, user: string) {
  await sql.query("INSERT INTO wallet_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING", [user]);
  return (
    await sql.query<{ balance: number }>(
      "SELECT balance FROM wallet_accounts WHERE user_id=$1 FOR UPDATE",
      [user],
    )
  )[0];
}
async function prior(sql: Sql, user: string, key: string, kind: string) {
  const [row] = await sql.query<{
    kind: string;
    result: Record<string, string | number | boolean | null>;
  }>("SELECT kind,result FROM operation_keys WHERE user_id=$1 AND key=$2", [user, key]);
  if (row && row.kind !== kind) throw new CommerceError("คำขอซ้ำไม่ตรงกับรายการเดิม");
  return row?.result;
}
async function remembered(
  sql: Sql,
  user: string,
  key: string,
  kind: string,
  result: Record<string, string | number | boolean | null>,
) {
  await sql.query("INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,$3,$4)", [
    user,
    key,
    kind,
    JSON.stringify(result),
  ]);
  return result;
}
export async function changeWallet(
  sql: Sql,
  actor: string,
  user: string,
  amount: number,
  reason: string,
  key: string,
) {
  return sql.transaction(async (tx) => {
    const [target] = await tx.query('SELECT id FROM "user" WHERE id=$1', [user]);
    if (!target) throw new CommerceError("ไม่พบสมาชิก");
    const account = await wallet(tx, user);
    const kind = `adjust:${user}:${amount}:${reason}`;
    const previous = await prior(tx, actor, key, kind);
    if (previous) return previous;
    const balance = Number(account.balance) + amount;
    if (!Number.isSafeInteger(amount) || amount === 0 || balance < 0 || balance > 2147483647)
      throw new CommerceError("ยอดเครดิตไม่ถูกต้องหรือไม่เพียงพอ");
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      user,
      balance,
    ]);
    await tx.query(
      "INSERT INTO wallet_ledger(id,user_id,amount,balance_after,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), user, amount, balance, amount > 0 ? "admin_add" : "admin_remove", actor],
    );
    await tx.query(
      "INSERT INTO transactions(id,user_id,kind,status,amount) VALUES($1,$2,$3,'success',$4)",
      [randomUUID(), user, amount > 0 ? "ADMIN_ADD" : "ADMIN_REMOVE", amount],
    );
    await audit(tx, actor, "wallet.adjusted", "user", user, {
      before: account.balance,
      amount,
      after: balance,
      reason,
    });
    await notify(tx, user, "เครดิตปรับปรุงแล้ว", reason);
    return remembered(tx, actor, key, kind, { balance });
  });
}
export async function refundOrder(sql: Sql, actor: string, orderId: string, reason: string) {
  const [owner] = await sql.query<{ user_id: string }>("SELECT user_id FROM orders WHERE id=$1", [
    orderId,
  ]);
  if (!owner) throw new CommerceError("ไม่พบออเดอร์");
  return sql.transaction(async (tx) => {
    const account = await wallet(tx, owner.user_id);
    const [order] = await tx.query<{ status: string; total: number }>(
      "SELECT status,total FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    if (order.status === "refunded") return { balance: account.balance, replay: true };
    if (!["processing", "completed", "paid"].includes(order.status))
      throw new CommerceError("ออเดอร์นี้คืนเงินไม่ได้");
    const balance = Number(account.balance) + Number(order.total);
    if (balance > 2147483647) throw new CommerceError("ยอดเกินขีดจำกัด");
    await tx.query("UPDATE orders SET status='refunded',updated_at=now() WHERE id=$1", [orderId]);
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      owner.user_id,
      balance,
    ]);
    if (order.total > 0)
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,order_id,amount,balance_after,reason,actor_id) VALUES($1,$2,$3,$4,$5,'refund',$6)",
        [randomUUID(), owner.user_id, orderId, order.total, balance, actor],
      );
    await tx.query(
      "INSERT INTO transactions(id,user_id,order_id,kind,status,amount) VALUES($1,$2,$3,'REFUND','success',$4)",
      [randomUUID(), owner.user_id, orderId, order.total],
    );
    await tx.query(
      "UPDATE claims SET status='refunded',reply=$2,updated_at=now() WHERE order_id=$1 AND status IN ('pending','accepted')",
      [orderId, reason],
    );
    // Sold credentials remain sold: refund must never make exposed credentials available again.
    await audit(tx, actor, "order.refunded", "order", orderId, { amount: order.total, reason });
    await notify(tx, owner.user_id, "คืนเครดิตแล้ว", `ออเดอร์ ${orderId}`);
    return { balance, replay: false };
  });
}
export async function deliverOrder(
  sql: Sql,
  actor: string,
  orderId: string,
  payload: string,
  replacement = false,
) {
  return sql.transaction(async (tx) => {
    const [order] = await tx.query<{
      status: string;
      user_id: string;
      product_id: string;
      warranty_days: number;
    }>(
      "SELECT o.status,o.user_id,i.product_id,p.warranty_days FROM orders o JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id WHERE o.id=$1 FOR UPDATE OF o",
      [orderId],
    );
    if (!order || !(replacement ? ["completed"] : ["processing", "paid"]).includes(order.status))
      throw new CommerceError("สถานะออเดอร์ไม่อนุญาตให้จัดส่ง");
    const sealed = encryptInventory(order.product_id, payload);
    await tx.query(
      "INSERT INTO order_deliveries(id,order_id,product_id,payload_ciphertext,actor_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), orderId, order.product_id, sealed.ciphertext, actor],
    );
    await tx.query(
      "UPDATE orders SET status='completed',updated_at=now(),warranty_end=CASE WHEN warranty_end IS NULL AND $2>0 THEN now()+$2*interval '1 day' ELSE warranty_end END WHERE id=$1",
      [orderId, order.warranty_days],
    );
    await audit(tx, actor, replacement ? "order.replaced" : "order.delivered", "order", orderId);
    await notify(tx, order.user_id, "จัดส่งสินค้าแล้ว", `ดูสินค้าในประวัติออเดอร์ ${orderId}`);
    return { ok: true };
  });
}
export async function createClaim(
  sql: Sql,
  user: string,
  orderId: string,
  title: string,
  message: string,
) {
  return sql.transaction(async (tx) => {
    const [order] = await tx.query<{ status: string; warranty_end: Date | null }>(
      "SELECT status,warranty_end FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [orderId, user],
    );
    if (!order || !["completed", "processing"].includes(order.status))
      throw new CommerceError("ไม่พบออเดอร์ที่สามารถแจ้งปัญหาได้");
    // Problems may always be reported; expired warranty is shown to staff, never a silent auto refund.
    const [existing] = await tx.query<{ id: string }>(
      "SELECT id FROM claims WHERE order_id=$1 AND status IN ('pending','accepted')",
      [orderId],
    );
    if (existing) return { id: existing.id };
    const id = randomUUID();
    await tx.query("INSERT INTO claims(id,order_id,user_id,title,message) VALUES($1,$2,$3,$4,$5)", [
      id,
      orderId,
      user,
      title,
      message,
    ]);
    await audit(tx, user, "claim.created", "claim", id, { orderId });
    return { id };
  });
}
export async function reviewPayment(
  sql: Sql,
  actor: string,
  id: string,
  approve: boolean,
  reference: string,
  reason: string,
  verifiedAmount?: number,
) {
  const [owner] = await sql.query<{ user_id: string }>("SELECT user_id FROM payments WHERE id=$1", [
    id,
  ]);
  if (!owner?.user_id) throw new CommerceError("ไม่พบผู้ชำระเงิน");
  return sql.transaction(async (tx) => {
    const account = await wallet(tx, owner.user_id);
    const [payment] = await tx.query<{
      status: string;
      amount: number;
      fee: number;
      provider: string;
      method: string;
    }>("SELECT status,amount,fee,provider,method FROM payments WHERE id=$1 FOR UPDATE", [id]);
    if (payment.status === "success") return { balance: account.balance, replay: true };
    if (!["pending", "reconciliation_required"].includes(payment.status))
      throw new CommerceError("รายการนี้ตรวจสอบแล้ว");
    if (!approve) {
      await tx.query("UPDATE payments SET status='rejected',reject_reason=$2 WHERE id=$1", [
        id,
        reason,
      ]);
      await audit(tx, actor, "payment.rejected", "payment", id, { reason });
      await notify(tx, owner.user_id, "เติมเงินไม่ผ่าน", reason);
      return { balance: account.balance };
    }
    if (verifiedAmount !== payment.amount)
      throw new CommerceError(
        "ยอดที่ตรวจสอบจริงไม่ตรงกับยอดที่แจ้ง กรุณาปฏิเสธและให้ส่งรายการใหม่",
      );
    if (!reference.trim()) throw new CommerceError("ต้องใส่เลขอ้างอิงธนาคารที่ตรวจสอบจริง");
    const credit = payment.amount - payment.fee;
    if (credit <= 0 || account.balance + credit > 2147483647)
      throw new CommerceError("ยอดเครดิตไม่ถูกต้อง");
    // Cross-method reference fence also catches two manual reviews of the same transfer.
    const duplicate = await tx.query(
      "SELECT id FROM transactions WHERE provider='verified-transfer' AND provider_ref=$1",
      [reference],
    );
    if (duplicate.length) throw new CommerceError("เลขอ้างอิงนี้เคยเติมเครดิตแล้ว");
    const fence = await tx.query(
      "INSERT INTO transfer_references(reference,payment_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING reference",
      [reference, id],
    );
    if (!fence.length) throw new CommerceError("เลขอ้างอิงนี้เคยเติมเครดิตแล้ว");
    const balance = Number(account.balance) + credit;
    await tx.query(
      "UPDATE payments SET status='success',provider_reference=$2,credit=$3,reject_reason=NULL WHERE id=$1",
      [id, reference, credit],
    );
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      owner.user_id,
      balance,
    ]);
    await tx.query(
      "INSERT INTO wallet_ledger(id,user_id,payment_id,amount,balance_after,reason,actor_id) VALUES($1,$2,$3,$4,$5,'topup',$6)",
      [randomUUID(), owner.user_id, id, credit, balance, actor],
    );
    await tx.query(
      "INSERT INTO transactions(id,user_id,payment_id,kind,status,amount,provider,provider_ref) VALUES($1,$2,$3,'TOPUP','success',$4,'verified-transfer',$5)",
      [randomUUID(), owner.user_id, id, credit, reference],
    );
    await audit(tx, actor, "payment.approved", "payment", id, { reference, credit, reason });
    await notify(tx, owner.user_id, "เติมเงินสำเร็จ", `${credit} บาท`);
    return { balance };
  });
}
export const giftHash = (code: string) =>
  createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
export async function redeemGift(sql: Sql, user: string, code: string, key: string) {
  return sql.transaction(async (tx) => {
    const account = await wallet(tx, user);
    const kind = `gift:${giftHash(code)}`;
    const prev = await prior(tx, user, key, kind);
    if (prev) return prev;
    const [gift] = await tx.query<{
      id: string;
      reward: string;
      amount: number;
      product_id: string;
      used: number;
      usage_limit: number;
      active: boolean;
      expires_at: Date | null;
    }>("SELECT * FROM gift_codes WHERE code_hash=$1 FOR UPDATE", [giftHash(code)]);
    if (
      !gift ||
      !gift.active ||
      (gift.expires_at && new Date(gift.expires_at) < new Date()) ||
      gift.used >= gift.usage_limit
    )
      throw new CommerceError("โค้ดไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว");
    if (
      (
        await tx.query("SELECT id FROM gift_redemptions WHERE gift_id=$1 AND user_id=$2", [
          gift.id,
          user,
        ])
      ).length
    )
      throw new CommerceError("คุณใช้โค้ดนี้แล้ว");
    let balance = Number(account.balance);
    let orderId: string | null = null;
    if (gift.reward === "credit") {
      balance += gift.amount;
      if (gift.amount <= 0 || balance > 2147483647) throw new CommerceError("รางวัลไม่ถูกต้อง");
      await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
        user,
        balance,
      ]);
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,'gift_code')",
        [randomUUID(), user, gift.amount, balance],
      );
      await tx.query(
        "INSERT INTO transactions(id,user_id,kind,status,amount) VALUES($1,$2,'GIFT_CODE','success',$3)",
        [randomUUID(), user, gift.amount],
      );
    } else {
      if (!gift.product_id) throw new CommerceError("สินค้าในโค้ดไม่พร้อมใช้งาน");
      const adapter = Object.assign(tx, {
        transaction: async <T>(work: (tx: Sql) => Promise<T>) => work(tx),
      });
      const result = await purchase(adapter, user, gift.product_id, `gift:${gift.id}:${user}`, {
        free: true,
      });
      orderId = result.orderId;
      balance = result.balance;
    }
    await tx.query("UPDATE gift_codes SET used=used+1 WHERE id=$1", [gift.id]);
    await tx.query(
      "INSERT INTO gift_redemptions(id,gift_id,user_id,order_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), gift.id, user, orderId],
    );
    await notify(
      tx,
      user,
      "รับของขวัญสำเร็จ",
      gift.reward === "credit" ? `${gift.amount} บาท` : "ดูสินค้าที่ประวัติการซื้อ",
    );
    return remembered(tx, user, key, kind, { balance, orderId });
  });
}

import type { Sql } from "../db";
import { randomUUID } from "node:crypto";
import { CommerceError } from "./commerce.server.ts";
import { audit, notify, changeWallet } from "./operations-service.server.ts";
import { encryptInventory, decryptInventory } from "./inventory-crypto.server.ts";
import type { RequestItem } from "./cart-request-service.server.ts";
export type CartClaim = {
  id: string;
  requestId: string;
  productId: string;
  userId: string;
  title: string;
  message: string;
  evidence: string;
  status: string;
  reply: string;
  createdAt: string;
};
/** Cart orders do not have an orders FK. Persist the claim in existing operational records,
 * which already participate in backups; legacy claims remain in their existing table. */
export async function cartClaimEligibility(sql: Sql, user: string, id: string) {
  const [r] = await sql.query<{
    items: RequestItem[];
    delivered_at: string;
    status: string;
    payment_status: string;
  }>(
    `SELECT r.items,r.delivered_at::text,r.status,p.status payment_status FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id WHERE r.id=$1 AND r.user_id=$2`,
    [id, user],
  );
  if (!r || r.status !== "done" || r.payment_status !== "paid" || !r.delivered_at)
    throw new CommerceError("ไม่พบออเดอร์ที่ส่งมอบแล้วของคุณ");
  const claims = await sql.query<{ result: CartClaim }>(
    "SELECT result FROM operation_keys WHERE user_id=$1 AND kind='cart_claim' AND result->>'requestId'=$2 ORDER BY created_at DESC",
    [user, id],
  );
  const products = await sql.query<{ id: string; warranty_days: number }>(
    "SELECT id,warranty_days FROM products WHERE id=ANY($1::text[])",
    [r.items.map((i) => i.productId)],
  );
  return {
    claims: claims.map((c) => c.result),
    items: r.items.map((i) => {
      const days = i.warrantyDays ?? products.find((p) => p.id === i.productId)?.warranty_days ?? 0;
      const end = new Date(Date.parse(r.delivered_at) + days * 86400000).toISOString();
      const active = claims.some(
        (c) =>
          c.result.productId === i.productId && ["pending", "accepted"].includes(c.result.status),
      );
      return {
        productId: i.productId,
        name: i.name,
        end,
        eligible: days > 0 && Date.parse(end) > Date.now() && !active,
        reason: active
          ? "มีเคลมที่กำลังดำเนินการ"
          : days === 0
            ? "สินค้านี้ไม่มีประกัน"
            : Date.parse(end) <= Date.now()
              ? "หมดระยะรับประกันแล้ว"
              : "",
      };
    }),
  };
}
export async function createCartClaim(
  sql: Sql,
  user: string,
  data: { requestId: string; productId: string; title: string; message: string; evidence: string },
) {
  return sql.transaction(async (tx) => {
    await tx.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
    const [member] = await tx.query<{ disabled: boolean }>(
      "SELECT disabled FROM member_profiles WHERE user_id=$1",
      [user],
    );
    if (member?.disabled) throw new CommerceError("บัญชีถูกระงับ กรุณาติดต่อร้าน");
    await tx.query("SELECT id FROM cart_requests WHERE id=$1 AND user_id=$2 FOR UPDATE", [
      data.requestId,
      user,
    ]);
    const state = await cartClaimEligibility(tx, user, data.requestId);
    const item = state.items.find((i) => i.productId === data.productId);
    if (!item?.eligible) throw new CommerceError(item?.reason || "สินค้าไม่อยู่ในออเดอร์");
    const id = randomUUID();
    const result: CartClaim = {
      ...data,
      id,
      userId: user,
      status: "pending",
      reply: "",
      createdAt: new Date().toISOString(),
    };
    await tx.query(
      "INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,'cart_claim',$3)",
      [user, id, JSON.stringify(result)],
    );
    await audit(tx, user, "claim.created", "cart_request", data.requestId, {
      claimId: id,
      productId: data.productId,
    });
    await notify(tx, user, "รับเรื่องเคลมแล้ว", `เลขเคลม ${id}`);
    return result;
  });
}
export async function reviewCartClaim(
  sql: Sql,
  actor: string,
  data: { id: string; status: string; reply: string; replacement?: string },
) {
  return sql.transaction(async (tx) => {
    const [lookup] = await tx.query<{ user_id: string; result: CartClaim }>(
      "SELECT user_id,result FROM operation_keys WHERE key=$1 AND kind='cart_claim'",
      [data.id],
    );
    if (!lookup) throw new CommerceError("ไม่พบเคลม");
    const c = lookup.result;
    const [r] = await tx.query<{
      items: RequestItem[];
      delivery_ciphertext: string;
      status: string;
      payment_status: string;
    }>(
      `SELECT r.items,r.delivery_ciphertext,r.status,p.status payment_status FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id WHERE r.id=$1 FOR UPDATE OF r,p`,
      [c.requestId],
    );
    const [current] = await tx.query<{ result: CartClaim }>(
      "SELECT result FROM operation_keys WHERE user_id=$1 AND key=$2 FOR UPDATE",
      [c.userId, c.id],
    );
    if (!current || !r || r.status !== "done" || r.payment_status !== "paid")
      throw new CommerceError("ออเดอร์ไม่พร้อมดำเนินการ");
    if (!["pending", "accepted"].includes(current.result.status))
      throw new CommerceError("เคลมปิดแล้ว กรุณาโหลดข้อมูลใหม่");
    if (data.status === "refunded") {
      const item = r.items.find((i) => i.productId === c.productId);
      const amount = item?.lineTotal ?? (item ? item.price * item.quantity : 0);
      if (!amount) throw new CommerceError("ไม่มีเงินที่ชำระสำหรับสินค้านี้");
      const refundKey = `cart-refund:${c.requestId}:${c.productId}`;
      if (
        (
          await tx.query("SELECT key FROM operation_keys WHERE user_id=$1 AND key=$2", [
            c.userId,
            refundKey,
          ])
        ).length
      )
        throw new CommerceError("สินค้านี้คืนเครดิตไปแล้ว");
      const adapter = Object.assign(tx, {
        transaction: async <T>(work: (sql: Sql) => Promise<T>) => work(tx),
      });
      await changeWallet(
        adapter,
        actor,
        c.userId,
        amount,
        `คืนเครดิตเคลม ${c.id}`,
        `claim-credit:${c.id}`,
      );
      await tx.query(
        "INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,'cart_refund',$3)",
        [c.userId, refundKey, JSON.stringify({ amount, claimId: c.id })],
      );
      // Revoke the refunded product's credentials while preserving other delivered lines.
      if (r.delivery_ciphertext) {
        const lines = JSON.parse(
          decryptInventory(`cart-delivery:${c.requestId}`, r.delivery_ciphertext),
        );
        for (const line of lines)
          if (line.productId === c.productId) {
            line.payload = "";
            line.instructions = "สินค้านี้คืนเครดิตแล้ว";
          }
        await tx.query("UPDATE cart_requests SET delivery_ciphertext=$2 WHERE id=$1", [
          c.requestId,
          encryptInventory(`cart-delivery:${c.requestId}`, JSON.stringify(lines)).ciphertext,
        ]);
      }
    }
    if (data.status === "replaced") {
      if (!data.replacement?.trim() || !r.delivery_ciphertext)
        throw new CommerceError("กรอกข้อมูลสินค้าทดแทนก่อนยืนยัน");
      if (
        (
          await tx.query("SELECT key FROM operation_keys WHERE user_id=$1 AND key=$2", [
            c.userId,
            `cart-refund:${c.requestId}:${c.productId}`,
          ])
        ).length
      )
        throw new CommerceError("สินค้านี้คืนเครดิตแล้ว");
      const lines = JSON.parse(
        decryptInventory(`cart-delivery:${c.requestId}`, r.delivery_ciphertext),
      );
      const line = lines.find((i: { productId: string }) => i.productId === c.productId);
      if (!line) throw new CommerceError("ไม่พบสินค้าที่ส่งมอบ");
      line.payload = data.replacement.trim();
      await tx.query("UPDATE cart_requests SET delivery_ciphertext=$2 WHERE id=$1", [
        c.requestId,
        encryptInventory(`cart-delivery:${c.requestId}`, JSON.stringify(lines)).ciphertext,
      ]);
    }
    const next = { ...current.result, status: data.status, reply: data.reply };
    await tx.query("UPDATE operation_keys SET result=$3 WHERE user_id=$1 AND key=$2", [
      c.userId,
      c.id,
      JSON.stringify(next),
    ]);
    await audit(tx, actor, "claim.resolved", "cart_request", c.requestId, {
      claimId: c.id,
      status: data.status,
    });
    await notify(tx, c.userId, "เคลมได้รับการอัปเดต", data.reply);
    return next;
  });
}

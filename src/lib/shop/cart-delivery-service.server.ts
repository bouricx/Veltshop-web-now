import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { encryptInventory, decryptInventory } from "./inventory-crypto.server.ts";
import { audit, notify } from "./operations-service.server.ts";
import { deductCartStock } from "./cart-status-service.server.ts";
import type { RequestItem } from "./cart-request-service.server.ts";

export type DeliveryChannel = "web" | "facebook" | "discord";
export type DeliveryLine = { productId: string; name: string; quantity: number; payload: string };
export type CartDeliveryInput = {
  id: string;
  expectedStatus: "pending" | "received";
  channel: DeliveryChannel;
  entries: { productId: string; payload: string }[];
  confirmedDelivered: boolean;
};
export async function fulfillCartRequest(sql: Sql, actor: string, data: CartDeliveryInput) {
  try {
    return await sql.transaction(async (tx) => {
      const [row] = await tx.query<{
        user_id: string;
        status: string;
        payment_status: string;
        items: RequestItem[];
      }>(
        `SELECT r.user_id,r.status,r.items,p.status AS payment_status FROM cart_requests r
         JOIN cart_request_payments p ON p.cart_request_id=r.id WHERE r.id=$1 FOR UPDATE OF r,p`,
        [data.id],
      );
      if (
        !row ||
        row.status !== data.expectedStatus ||
        !["pending", "received"].includes(row.status)
      )
        throw new CommerceError("สถานะรายการเปลี่ยนแล้ว กรุณาโหลดใหม่ ยังไม่ส่งข้อมูลซ้ำ");
      if (row.payment_status !== "paid")
        throw new CommerceError("ยืนยันยอดเงินเข้าจริงก่อนส่งสินค้า");
      if (!data.confirmedDelivered)
        throw new CommerceError("ยืนยันว่าข้อมูลครบหรือจัดส่งผ่านช่องทางที่เลือกแล้ว");
      if (!["web", "facebook", "discord"].includes(data.channel))
        throw new CommerceError("ช่องทางจัดส่งไม่ถูกต้อง");
      let ciphertext: string | null = null;
      if (data.channel === "web") {
        if (
          data.entries.length !== row.items.length ||
          new Set(data.entries.map((e) => e.productId)).size !== row.items.length
        )
          throw new CommerceError("กรอกข้อมูลให้ครบทุกสินค้าในรายการ");
        const lines: DeliveryLine[] = row.items.map((item) => {
          const entry = data.entries.find((e) => e.productId === item.productId);
          const payload = entry?.payload.trim();
          if (!payload || payload.length > 10000)
            throw new CommerceError(`กรอกข้อมูล ${item.name} ให้ครบ ไม่เกิน 10,000 ตัวอักษร`);
          return { ...item, payload };
        });
        const encoded = JSON.stringify(lines);
        if (encoded.length > 60000)
          throw new CommerceError("ข้อมูลจัดส่งมากเกินไป กรุณาติดต่อผู้ดูแลระบบ");
        ciphertext = encryptInventory(`cart-delivery:${data.id}`, encoded).ciphertext;
      } else if (data.entries.length)
        throw new CommerceError("ข้อมูลรหัสในเว็บใช้ได้เฉพาะช่องทางส่งในเว็บ");
      await deductCartStock(tx, actor, data.id, row.items);
      await tx.query(
        `UPDATE cart_requests SET status='done',delivery_ciphertext=$2,delivery_channel=$3,
         delivered_at=now(),delivered_by=$4,updated_at=now() WHERE id=$1`,
        [data.id, ciphertext, data.channel, actor],
      );
      // Audit and notification bodies intentionally never contain the supplied credentials.
      await audit(tx, actor, "cart.delivered", "cart_request", data.id, {
        channel: data.channel,
        lines: row.items.length,
      });
      await notify(
        tx,
        row.user_id,
        "จัดส่งสินค้าแล้ว",
        `เลขรายการ ${data.id} · ${data.channel === "web" ? "เปิดตะกร้า → รายการสั่งซื้อของฉัน → ดูข้อมูลสินค้า" : `จัดส่งทาง ${data.channel === "facebook" ? "Facebook Page" : "Discord"} แล้ว`}`,
      );
      return {
        ok: true as const,
        message:
          data.channel === "web"
            ? "ส่งข้อมูลสินค้าให้ลูกค้าในเว็บแล้ว"
            : "ยืนยันจัดส่งผ่านช่องทางที่เลือกแล้ว",
      };
    });
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof CommerceError
          ? error.message
          : "ส่งสินค้าไม่สำเร็จ กรุณาโหลดสถานะก่อนลองใหม่",
    };
  }
}

export async function readCartDelivery(sql: Sql, userId: string, id: string) {
  const [row] = await sql.query<{ delivery_ciphertext: string; delivered_at: string }>(
    `SELECT r.delivery_ciphertext,r.delivered_at::text FROM cart_requests r
     JOIN cart_request_payments p ON p.cart_request_id=r.id
     WHERE r.id=$1 AND r.user_id=$2 AND r.status='done' AND p.status='paid'
       AND r.delivery_channel='web' AND r.delivery_ciphertext IS NOT NULL`,
    [id, userId],
  );
  if (!row) return null;
  const entries: DeliveryLine[] = JSON.parse(
    decryptInventory(`cart-delivery:${id}`, row.delivery_ciphertext),
  );
  return { entries, deliveredAt: row.delivered_at };
}

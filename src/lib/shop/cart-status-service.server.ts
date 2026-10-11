import { randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { audit, notify } from "./operations-service.server.ts";
import type { RequestItem } from "./cart-request-service.server.ts";
export async function deductCartStock(tx: Sql, actor: string, id: string, items: RequestItem[]) {
  for (const item of [...items].sort((a, b) => a.productId.localeCompare(b.productId))) {
    const [product] = await tx.query(
      "UPDATE products SET stock=stock-$2,updated_at=now() WHERE id=$1 AND stock_mode='quantity' AND stock >= $2 RETURNING id",
      [item.productId, item.quantity],
    );
    if (!product) throw new CommerceError("สต็อกสินค้าเปลี่ยนแล้ว กรุณาตรวจสอบก่อนยืนยันการจัดส่ง");
    await tx.query(
      "INSERT INTO inventory_movements(id,product_id,quantity,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), item.productId, -item.quantity, `cart:${id}`, actor],
    );
  }
}
export async function changeCartRequestStatus(
  sql: Sql,
  actor: string,
  data: { id: string; expectedStatus: string; status: "received" | "done" | "cancelled" },
) {
  try {
    return await sql.transaction(async (tx) => {
      const [row] = await tx.query<{
        user_id: string;
        status: string;
        payment_status: string;
        items: RequestItem[];
      }>(
        `SELECT r.user_id,r.status,r.items,p.status AS payment_status
         FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
         WHERE r.id=$1 FOR UPDATE OF r,p`,
        [data.id],
      );
      if (!row || row.status !== data.expectedStatus || ["done", "cancelled"].includes(row.status))
        return { ok: false, message: "รายการเปลี่ยนสถานะแล้ว กรุณาโหลดใหม่" };
      if (data.status !== "cancelled" && row.payment_status !== "paid")
        return { ok: false, message: "ยังจัดการรายการไม่ได้ เพราะยังไม่ยืนยันการชำระเงิน" };
      if (
        data.status === "cancelled" &&
        ["paid", "verifying", "manual_review"].includes(row.payment_status)
      )
        return {
          ok: false,
          message: "รายการนี้มีการชำระหรือหลักฐานรอตรวจ กรุณาตรวจสอบยอดและติดต่อผู้ซื้อก่อนยกเลิก",
        };
      if (data.status === "done") {
        return {
          ok: false,
          message: "ใช้ปุ่มส่งสินค้าเพื่อบันทึกข้อมูลหรือยืนยันช่องทางจัดส่งก่อนเสร็จสิ้น",
        };
      }
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
        done: "ร้านจัดส่งสินค้าเรียบร้อยแล้ว",
        cancelled: "รายการถูกยกเลิก",
      }[data.status];
      await notify(tx, row.user_id, label, `เลขรายการ ${data.id} · สถานะรายการอัปเดตแล้ว`);
      return { ok: true, message: label };
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof CommerceError ? error.message : "บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

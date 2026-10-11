import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { audit } from "./operations-service.server.ts";

export type SavedUsageGuide = { product_id: string; instructions: string; version: number };
export type UsageGuideUpdate = { productId: string; instructions: string; expectedVersion: number };

export async function readProductUsageGuides(sql: Sql, productIds: string[]) {
  return sql.query<SavedUsageGuide>(
    "SELECT product_id,instructions,version FROM product_usage_guides WHERE product_id=ANY($1::text[])",
    [productIds],
  );
}

export async function saveProductUsageGuides(sql: Sql, actor: string, updates: UsageGuideUpdate[]) {
  try {
    if (
      !updates.length ||
      updates.length > 30 ||
      new Set(updates.map((i) => i.productId)).size !== updates.length
    )
      throw new CommerceError("เลือกรายการสินค้าให้ถูกต้อง");
    if (
      updates.some(
        (i) =>
          !i.instructions.trim() ||
          i.instructions.trim().length > 10000 ||
          !Number.isInteger(i.expectedVersion) ||
          i.expectedVersion < 0,
      )
    )
      throw new CommerceError("กรอกวิธีใช้งาน 1–10,000 ตัวอักษรให้ครบทุกสินค้า");
    return await sql.transaction(async (tx) => {
      const saved: SavedUsageGuide[] = [];
      for (const update of [...updates].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const products = await tx.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [
          update.productId,
        ]);
        if (!products.length) throw new CommerceError("ไม่พบสินค้า กรุณาโหลดรายการใหม่");
        const [current] = await readProductUsageGuides(tx, [update.productId]);
        if ((current?.version ?? 0) !== update.expectedVersion)
          throw new CommerceError(
            "มีการแก้ไขวิธีใช้งานจากหน้าอื่นแล้ว กรุณาโหลดคำแนะนำล่าสุดก่อนบันทึก",
          );
        const [row] = await tx.query<SavedUsageGuide>(
          `INSERT INTO product_usage_guides(product_id,instructions,version,updated_by)
           VALUES($1,$2,$3,$4) ON CONFLICT(product_id) DO UPDATE SET
           instructions=EXCLUDED.instructions,version=EXCLUDED.version,updated_by=EXCLUDED.updated_by,updated_at=now()
           RETURNING product_id,instructions,version`,
          [update.productId, update.instructions.trim(), update.expectedVersion + 1, actor],
        );
        saved.push(row);
        await audit(tx, actor, "product.usage_guide_saved", "product", update.productId, {
          version: row.version,
        });
      }
      return {
        ok: true as const,
        message: "บันทึกวิธีใช้งานแล้ว · ใช้กับออเดอร์ถัดไปได้",
        guides: saved,
      };
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof CommerceError ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

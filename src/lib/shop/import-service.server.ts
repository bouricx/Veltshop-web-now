import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { productInputSchema } from "./validation.ts";
import { CommerceError } from "./commerce.server.ts";
import { giftHash, audit } from "./operations-service.server.ts";
const giftSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{16,128}$/),
  label: z.string().trim().min(1).max(120),
  reward: z.enum(["credit", "product"]),
  amount: z.number().int().min(0).max(1000000),
  productId: z.string().min(1).max(160).nullable(),
  categoryId: z.string().min(1).max(120).nullable().optional(),
  usageLimit: z.number().int().min(1).max(1000000),
  expiresAt: z.string().datetime().nullable(),
  active: z.boolean(),
});
export function validateImport(kind: "products" | "gifts", rows: unknown[]) {
  if (!rows.length || rows.length > 200) throw new CommerceError("นำเข้าได้ 1–200 รายการต่อครั้ง");
  const parsed = rows.map((row, index) => {
    const result = (kind === "products" ? productInputSchema : giftSchema).safeParse(row);
    if (!result.success)
      throw new CommerceError(
        `รายการ ${index + 1}: ${result.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
      );
    return result.data;
  });
  return parsed;
}
export async function importRecords(
  sql: Sql,
  actor: string,
  kind: "products" | "gifts",
  rows: unknown[],
  key: string,
) {
  const parsed = validateImport(kind, rows),
    identity =
      "import:" + kind + ":" + createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
  return sql.transaction(async (tx) => {
    const [old] = await tx.query<{ kind: string; result: { count: number } }>(
      "SELECT kind,result FROM operation_keys WHERE user_id=$1 AND key=$2",
      [actor, key],
    );
    if (old) {
      if (old.kind !== identity) throw new CommerceError("คำขอซ้ำไม่ตรงไฟล์");
      return old.result;
    }
    for (const record of parsed) {
      const id = randomUUID();
      if (kind === "products") {
        const p = productInputSchema.parse(record);
        const [inserted] = await tx.query(
          "INSERT INTO products(id,name,subtitle,category_id,price,compare_at,stock,image,delivery,warranty_days,card_color,badge,sort_order,featured,flash,active,description,icon,border_color,accent_color,badge_color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT(id) DO NOTHING RETURNING id",
          [
            p.id || id,
            p.name,
            p.subtitle,
            p.category,
            p.price,
            p.compareAt ?? null,
            p.stock,
            p.image,
            p.delivery,
            p.warrantyDays ?? 0,
            p.cardColor ?? "#18181b",
            p.badge ?? "",
            p.sortOrder ?? 0,
            p.featured ?? false,
            p.flash ?? false,
            p.active ?? true,
            p.description ?? "",
            p.icon ?? "",
            p.borderColor ?? "",
            p.accentColor ?? "",
            p.badgeColor ?? "",
          ],
        );
        if (!inserted) throw new CommerceError("รหัสสินค้าซ้ำ รายการทั้งหมดถูกยกเลิก");
      } else {
        const g = giftSchema.parse(record);
        if (
          (g.reward === "credit" && !g.amount) ||
          (g.reward === "product" &&
            Number(Boolean(g.productId)) + Number(Boolean(g.categoryId)) !== 1)
        )
          throw new CommerceError("รางวัลโค้ดไม่ครบ");
        const [inserted] = await tx.query(
          "INSERT INTO gift_codes(id,code_hash,label,reward,amount,product_id,active,expires_at,usage_limit,category_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(code_hash) DO NOTHING RETURNING id",
          [
            id,
            giftHash(g.code),
            g.label,
            g.reward,
            g.amount,
            g.reward === "product" ? g.productId : null,
            g.active,
            g.expiresAt,
            g.usageLimit,
            g.reward === "product" ? (g.categoryId ?? null) : null,
          ],
        );
        if (!inserted) throw new CommerceError("โค้ดซ้ำ รายการทั้งหมดถูกยกเลิก");
      }
    }
    const result = { count: parsed.length };
    await tx.query("INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,$3,$4)", [
      actor,
      key,
      identity,
      JSON.stringify(result),
    ]);
    await audit(tx, actor, "data.imported", kind, key, result);
    return result;
  });
}

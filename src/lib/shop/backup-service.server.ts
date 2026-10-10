import { randomBytes, createCipheriv, createDecipheriv, createHash, randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { audit } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";
export const backupTables = [
  "user",
  "account",
  "session",
  "verification",
  "categories",
  "products",
  "shop_settings",
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "payments",
  "orders",
  "order_items",
  "wallet_accounts",
  "wallet_ledger",
  "inventory_movements",
  "transactions",
  "audit_logs",
  "inventory_items",
  "order_deliveries",
  "operation_keys",
  "claims",
  "member_profiles",
  "gift_codes",
  "gift_redemptions",
  "coupons",
  "coupon_uses",
  "content_blocks",
  "site_configuration",
  "notifications",
  "jobs",
  "media_assets",
  "payment_verifications",
  "transfer_references",
  "reward_campaigns",
  "reward_plays",
  "login_history",
] as const;
export type Snapshot = {
  version: 1;
  migration: string;
  createdAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};
function backupKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!/^[a-f\d]{64}$/i.test(value ?? ""))
    throw new CommerceError("ยังไม่ได้ตั้งค่ากุญแจสำรองข้อมูล");
  return Buffer.from(value!, "hex");
}
export function sealBackup(value: Snapshot) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", backupKey(), iv);
  cipher.setAAD(Buffer.from("veltshop-backup-v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("VELT1"), iv, cipher.getAuthTag(), ciphertext]);
}
export function openBackup(bytes: Uint8Array): Snapshot {
  try {
    const data = Buffer.from(bytes);
    if (data.subarray(0, 5).toString() !== "VELT1") throw Error();
    const decipher = createDecipheriv("aes-256-gcm", backupKey(), data.subarray(5, 17));
    decipher.setAAD(Buffer.from("veltshop-backup-v1"));
    decipher.setAuthTag(data.subarray(17, 33));
    const value = JSON.parse(
      Buffer.concat([decipher.update(data.subarray(33)), decipher.final()]).toString(),
    );
    if (
      value.version !== 1 ||
      !value.tables ||
      Array.isArray(value.tables) ||
      Object.values(value.tables).some(
        (rows) =>
          !Array.isArray(rows) ||
          rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)),
      ) ||
      Object.keys(value.tables).some(
        (k) => !backupTables.includes(k as (typeof backupTables)[number]),
      )
    )
      throw Error();
    return value;
  } catch {
    throw new CommerceError("ไฟล์สำรองไม่ถูกต้องหรือกุญแจไม่ตรง");
  }
}
export async function snapshot(sql: Sql): Promise<Snapshot> {
  return sql.transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const tables: Snapshot["tables"] = {};
    for (const table of backupTables) {
      const rows = await tx.query<{ data: Record<string, unknown> }>(
        `SELECT to_jsonb(t) AS data FROM "${table}" t`,
      );
      tables[table] = rows.map((r) => r.data);
    }
    return { version: 1, migration: "0011", createdAt: new Date().toISOString(), tables };
  });
}
export async function restoreIntoEmpty(sql: Sql, value: Snapshot) {
  return sql.transaction(async (tx) => {
    const seedTables = new Set([
      "roles",
      "permissions",
      "role_permissions",
      "shop_settings",
      "site_configuration",
    ]);
    for (const table of backupTables) {
      if (!seedTables.has(table) && (await tx.query(`SELECT 1 FROM "${table}" LIMIT 1`)).length)
        throw new CommerceError("กู้คืนได้เฉพาะฐานข้อมูลว่างที่แยกจากระบบใช้งาน");
    }
    for (const table of [
      "role_permissions",
      "roles",
      "permissions",
      "shop_settings",
      "site_configuration",
    ]) {
      await tx.query(`DELETE FROM "${table}"`);
    }
    for (const table of backupTables) {
      for (const row of value.tables[table] ?? []) {
        const columns = Object.keys(row);
        if (columns.some((c) => !/^\w+$/.test(c)))
          throw new CommerceError("รูปแบบคอลัมน์ไม่ถูกต้อง");
        const params = Object.values(row).map((v) =>
          typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        );
        await tx.query(
          `INSERT INTO "${table}"(${columns.map((c) => '"' + c + '"').join(",")}) VALUES(${columns.map((_, i) => "$" + (i + 1)).join(",")})`,
          params,
        );
      }
    }
    return {
      tables: backupTables.length,
      rows: Object.values(value.tables).reduce((n, rows) => n + rows.length, 0),
    };
  });
}
export async function createBackup(sql: Sql, actor: string) {
  const value = await snapshot(sql);
  const encoded = sealBackup(value);
  if (encoded.length > 25 * 1024 * 1024)
    throw new CommerceError("ข้อมูลใหญ่เกินการสำรองผ่านเว็บ ใช้การสำรองจากผู้ให้บริการฐานข้อมูล");
  const checksum = createHash("sha256").update(encoded).digest("hex");
  const id = randomUUID();
  await sql.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO backup_records(id,status,checksum,bytes) VALUES($1,'created',$2,$3)",
      [id, checksum, encoded],
    );
    await audit(tx, actor, "backup.created", "backup", id, { checksum, size: encoded.length });
  });
  return { id, checksum };
}

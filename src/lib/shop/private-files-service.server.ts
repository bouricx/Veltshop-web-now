import { createHash } from "node:crypto";
import type { Sql } from "../db";
import { encryptInventory, decryptInventory } from "./inventory-crypto.server.ts";
import { addInventoryItem, readOwnedDelivery } from "./inventory-service.server.ts";
import { CommerceError } from "./commerce.server.ts";

export const PRIVATE_FILE_LIMIT = 2 * 1024 * 1024;
export async function addPrivateFile(
  sql: Sql,
  actor: string,
  input: { id: string; productId: string; name: string; encoded: string },
) {
  const bytes = Buffer.from(input.encoded, "base64");
  if (
    !bytes.length ||
    bytes.length > PRIVATE_FILE_LIMIT ||
    bytes.toString("base64") !== input.encoded
  )
    throw new CommerceError("ไฟล์ต้องมีขนาดไม่เกิน 2 MB");
  const name = input.name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .slice(0, 120);
  const ext = name.split(".").pop()?.toLowerCase();
  let mime: string;
  if (ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else if (
    ext === "zip" &&
    ["504b0304", "504b0506", "504b0708"].includes(bytes.subarray(0, 4).toString("hex"))
  )
    mime = "application/zip";
  else if (ext === "txt" && !bytes.includes(0) && !bytes.subarray(0, 2).equals(Buffer.from("MZ"))) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CommerceError("ไฟล์ข้อความต้องเป็น UTF-8");
    }
    mime = "text/plain";
  } else throw new CommerceError("รองรับไฟล์ PDF, ZIP และ TXT ที่อ่านได้เท่านั้น");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return sql.transaction(async (tx) => {
    await tx.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [input.productId]);
    const [existing] = await tx.query<{ product_id: string; content_hash: string; name: string }>(
      "SELECT product_id,content_hash,name FROM private_files WHERE id=$1",
      [input.id],
    );
    if (existing) {
      if (
        existing.product_id !== input.productId ||
        existing.content_hash !== hash ||
        existing.name !== name
      )
        throw new CommerceError("คำขอนี้ใช้กับไฟล์อื่นแล้ว");
      return { ok: true as const, message: "บันทึกไฟล์และสต็อกแล้ว" };
    }
    const adapter = Object.assign(tx, {
      transaction: async <T>(work: (tx: Sql) => Promise<T>) => work(tx),
    });
    const result = await addInventoryItem(
      adapter,
      actor,
      input.productId,
      `/api/files/${input.id}`,
    );
    if (!result.ok) throw new CommerceError("ไฟล์นี้มีในสต็อกแล้ว");
    const sealed = encryptInventory(
      `file:${input.productId}:${input.id}`,
      bytes.toString("base64"),
    );
    await tx.query(
      "INSERT INTO private_files(id,product_id,inventory_id,name,mime,size,content_hash,ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        input.id,
        input.productId,
        result.inventoryId,
        name,
        mime,
        bytes.length,
        hash,
        sealed.ciphertext,
      ],
    );
    return { ok: true as const, message: "เพิ่มไฟล์สินค้าและสต็อกจริงแล้ว" };
  });
}
export async function downloadOwnedFile(sql: Sql, userId: string, fileId: string) {
  // Both stock ownership and the currently valid delivery are required. Replacement/refund revoke old files.
  const [row] = await sql.query<{
    id: string;
    product_id: string;
    name: string;
    mime: string;
    ciphertext: string;
    order_id: string;
  }>(
    "SELECT f.*,i.order_id FROM private_files f JOIN inventory_items i ON i.id=f.inventory_id JOIN orders o ON o.id=i.order_id WHERE f.id=$1 AND o.user_id=$2 AND o.status='completed' AND i.status='sold'",
    [fileId, userId],
  );
  if (!row || (await readOwnedDelivery(sql, userId, row.order_id)) !== `/api/files/${fileId}`)
    return null;
  return {
    name: row.name,
    mime: row.mime,
    bytes: Buffer.from(
      decryptInventory(`file:${row.product_id}:${row.id}`, row.ciphertext),
      "base64",
    ),
  };
}

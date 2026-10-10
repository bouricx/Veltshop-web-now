import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.INVENTORY_ENCRYPTION_KEY?.trim();
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new Error("ยังไม่ได้ตั้งค่าการเข้ารหัสสต็อก");
  return Buffer.from(raw, "hex");
}
export function encryptInventory(productId: string, payload: string) {
  const secret = key();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(Buffer.from(productId));
  const body = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return {
    ciphertext: [
      "v1",
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      body.toString("base64"),
    ].join("."),
    fingerprint: createHmac("sha256", secret)
      .update(productId)
      .update("\0")
      .update(payload)
      .digest("hex"),
  };
}
export function decryptInventory(productId: string, encoded: string): string {
  const secret = key();
  const [version, iv, tag, body, ...extra] = encoded.split(".");
  if (version !== "v1" || !iv || !tag || !body || extra.length)
    throw new Error("ไม่สามารถเปิดข้อมูลสินค้าได้");
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(productId));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error("ไม่สามารถเปิดข้อมูลสินค้าได้");
  }
}

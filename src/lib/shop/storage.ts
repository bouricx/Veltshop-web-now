import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type StoredImage = { url: string; message: string };

export interface ImageStorage {
  putProductImage(input: {
    bytes: Uint8Array;
    extension: string;
    fileName?: string;
    dataUrl: string;
  }): Promise<StoredImage>;
}

/**
 * Current storage behavior behind a provider-neutral boundary. Filesystem
 * writes are used when the runtime is writable; otherwise the validated data
 * URL remains portable with the product row until an object provider is chosen.
 */
export const productImageStorage: ImageStorage = {
  async putProductImage({ bytes, extension, fileName, dataUrl }) {
    const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (!serverless) {
      try {
        const dir = join(process.cwd(), "public", "uploads", "products");
        await mkdir(dir, { recursive: true });
        const safeBase =
          (fileName || "product")
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .slice(0, 40) || "product";
        const name = `${safeBase}-${Date.now().toString(36)}.${extension}`;
        await writeFile(join(dir, name), bytes);
        return { url: `/uploads/products/${name}`, message: "อัปโหลดรูปแล้ว" };
      } catch {
        // Read-only deployments use the durable row-backed fallback below.
      }
    }
    return { url: dataUrl, message: "อัปโหลดรูปแล้ว (เก็บกับสินค้า — ใช้ได้บน Vercel)" };
  },
};

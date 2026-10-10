import sharp from "sharp";
import { randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { configuration, audit } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";
export const mediaKinds = [
  "product",
  "category",
  "banner",
  "logo",
  "favicon",
  "profile",
  "announcement",
  "icon",
] as const;
export async function storeMedia(
  sql: Sql,
  actor: string,
  kind: (typeof mediaKinds)[number],
  dataUrl: string,
  fileName: string,
) {
  const settings = await configuration(sql);
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new CommerceError("รองรับ PNG, JPEG และ WebP เท่านั้น");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > settings.imageMaxMb * 1024 * 1024 || bytes.length < 8)
    throw new CommerceError(`ไฟล์ต้องไม่เกิน ${settings.imageMaxMb} MB`);
  if (fileName && !/\.(png|jpe?g|webp)$/i.test(fileName))
    throw new CommerceError("นามสกุลไฟล์ไม่ตรงกับรูปภาพ");
  const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new CommerceError("ไฟล์รูปเสียหายหรืออ่านไม่ได้");
  }
  if (
    metadata.format !== (match[1] === "jpeg" ? "jpeg" : match[1]) ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1
  )
    throw new CommerceError("ชนิดไฟล์ไม่ตรงหรือเป็นภาพเคลื่อนไหว");
  const isBanner = kind === "banner";
  const isLogo = kind === "logo";
  const width = isBanner ? settings.imageBannerWidth : isLogo ? 500 : settings.imageSquare;
  const height = isBanner ? settings.imageBannerHeight : isLogo ? 150 : settings.imageSquare;
  const optimized = await image
    .rotate()
    .resize(width, height, {
      // Preserve the full artwork for products, categories, icons, and logos.
      // Only banners and profile photos intentionally fill/crop their frame.
      fit: isBanner || kind === "profile" ? "cover" : "contain",
      background: kind === "product" ? "#ffffff" : { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: settings.imageQuality })
    .toBuffer();
  const thumbnail = await sharp(optimized)
    .resize(240, 240, { fit: "inside" })
    .webp({ quality: 75 })
    .toBuffer();
  const id = randomUUID();
  await sql.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO media_assets(id,kind,mime,width,height,bytes,thumbnail) VALUES($1,$2,'image/webp',$3,$4,$5,$6)",
      [id, kind, width, height, optimized, thumbnail],
    );
    await audit(tx, actor, "media.created", "media", id, {
      kind,
      width,
      height,
      size: optimized.length,
    });
  });
  return {
    id,
    url: `/api/media/${id}`,
    thumbnail: `/api/media/${id}?variant=thumbnail`,
    width,
    height,
    size: optimized.length,
    mime: "image/webp",
  };
}

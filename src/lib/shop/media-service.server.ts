import { imageTarget, allowedImageFormats } from "./image-policy.ts";
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
  if (!allowedImageFormats(settings).includes(match[1]))
    throw new CommerceError("ชนิดรูปนี้ถูกปิดในตั้งค่าร้าน");
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
  const { width: recommendedWidth, height: recommendedHeight } = imageTarget(kind, settings);
  const width = settings.imageAutoResize ? recommendedWidth : metadata.width;
  const height = settings.imageAutoResize ? recommendedHeight : metadata.height;
  if (width > 2560 || height > 2560)
    throw new CommerceError("รูปเกิน 2560 px กรุณาเปิดย่ออัตโนมัติหรือย่อรูปก่อนบันทึก");
  let pipeline = image.rotate();
  if (settings.imageAutoResize)
    pipeline = pipeline.resize(width, height, {
      fit: settings.imageAutoCrop || kind === "banner" || kind === "profile" ? "cover" : "contain",
      background: kind === "product" ? "#ffffff" : { r: 0, g: 0, b: 0, alpha: 0 },
    });
  const optimized = await pipeline.webp({ quality: settings.imageQuality }).toBuffer();
  const outputMetadata = await sharp(optimized).metadata();
  const thumbnail = await sharp(optimized)
    .resize(settings.imageThumbnail, settings.imageThumbnail, { fit: "inside" })
    .webp({ quality: 75 })
    .toBuffer();
  const id = randomUUID();
  await sql.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO media_assets(id,kind,mime,width,height,bytes,thumbnail) VALUES($1,$2,'image/webp',$3,$4,$5,$6)",
      [id, kind, outputMetadata.width, outputMetadata.height, optimized, thumbnail],
    );
    await audit(tx, actor, "media.created", "media", id, {
      kind,
      width: outputMetadata.width,
      height: outputMetadata.height,
      size: optimized.length,
    });
  });
  return {
    id,
    url: `/api/media/${id}`,
    thumbnail: `/api/media/${id}?variant=thumbnail`,
    width: outputMetadata.width!,
    height: outputMetadata.height!,
    size: optimized.length,
    mime: "image/webp",
  };
}

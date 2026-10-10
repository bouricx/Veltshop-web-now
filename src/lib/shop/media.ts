import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { mediaKinds, storeMedia } from "./media-service.server";
import { audit, limit } from "./operations-service.server";
export const uploadMedia = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        kind: z.enum(mediaKinds),
        dataUrl: z.string().max(7500000),
        fileName: z.string().max(240),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (data.kind !== "profile")
      await requirePermission(String(context.userId), "media.manage", context.bearerToken);
    const sql = await getSql();
    await limit(sql, `media:${context.userId}`, 10);
    return storeMedia(sql, String(context.userId), data.kind, data.dataUrl, data.fileName);
  });
export const listMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "media.manage", context.bearerToken);
    return (await getSql()).query<{
      id: string;
      kind: string;
      width: number;
      height: number;
      size: number;
      created_at: string;
    }>(
      "SELECT id,kind,width,height,octet_length(bytes)::int AS size,created_at::text FROM media_assets ORDER BY created_at DESC LIMIT 100",
    );
  });
export const deleteMedia = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "media.manage", context.bearerToken);
    const sql = await getSql();
    return sql.transaction(async (tx) => {
      const url = `/api/media/${data.id}`;
      await tx.query(
        'LOCK TABLE products,categories,content_blocks,site_configuration,"user" IN SHARE ROW EXCLUSIVE MODE',
      );
      const [use] = await tx.query<{ used: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM categories WHERE image=$1 UNION ALL SELECT 1 FROM products WHERE image=$1 UNION ALL SELECT 1 FROM content_blocks WHERE image=$1 UNION ALL SELECT 1 FROM "user" WHERE image=$1 UNION ALL SELECT 1 FROM site_configuration WHERE value::text LIKE $2) AS used`,
        [url, `%${url}%`],
      );
      if (use.used)
        return { ok: false as const, message: "รูปนี้ยังถูกใช้งานอยู่ กรุณาเปลี่ยนรูปก่อนลบ" };
      await tx.query("DELETE FROM media_assets WHERE id=$1", [data.id]);
      await audit(tx, String(context.userId), "media.deleted", "media", data.id);
      return { ok: true as const };
    });
  });

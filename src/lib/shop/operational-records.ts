import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { limit } from "./operations-service.server";
const definitions = {
  media: {
    permission: "media.manage",
    query:
      "SELECT id,kind,width,height,octet_length(bytes)::int AS size,created_at::text,''::text AS status FROM media_assets",
    search: "id,kind",
  },
  backups: {
    permission: "system.manage",
    query:
      "SELECT id,status,checksum,octet_length(bytes)::int AS size,created_at::text,verified_at::text FROM backup_records",
    search: "id,status,checksum",
  },
  privacy: {
    permission: "system.manage",
    query:
      'SELECT r.id,r.user_id,u.name,u.email,r.status,r.reason,r.reply,r.created_at::text FROM privacy_requests r JOIN "user" u ON u.id=r.user_id',
    search: "id,user_id,name,email,reason,status",
  },
} as const;
export const listOperationalRecords = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    z
      .object({
        kind: z.enum(["media", "backups", "privacy"]),
        search: z.string().max(200).default(""),
        status: z.string().max(60).default(""),
        page: z.number().int().min(0).max(100000).default(0),
        descending: z.boolean().default(true),
        from: z.string().datetime().nullable().default(null),
        to: z.string().datetime().nullable().default(null),
      })
      .parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const definition = definitions[data.kind];
    await requirePermission(String(context.userId), definition.permission, context.bearerToken);
    const sql = await getSql();
    await limit(sql, `admin-read:${context.userId}`, 120);
    const search = definition.search
      .split(",")
      .map((column) => `COALESCE(${column}::text,'')`)
      .join("||' '||");
    const where = `(${search}) ILIKE $1 AND ($2='' OR status=$2) AND ($3::timestamptz IS NULL OR created_at::timestamptz>=$3) AND ($4::timestamptz IS NULL OR created_at::timestamptz<$4)`;
    const params = [`%${data.search}%`, data.status, data.from, data.to];
    const rows = await sql.query<Record<string, string | number | boolean | null>>(
      `SELECT * FROM (${definition.query}) records WHERE ${where} ORDER BY created_at ${data.descending ? "DESC" : "ASC"},id LIMIT 24 OFFSET $5`,
      [...params, data.page * 24],
    );
    const [count] = await sql.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM (${definition.query}) records WHERE ${where}`,
      params,
    );
    return { rows, total: count.total };
  });

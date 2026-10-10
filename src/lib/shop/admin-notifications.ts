import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
export const listAdminNotifications = createServerFn({ method: "GET" })
  .validator((v: unknown) =>
    z
      .object({
        page: z.number().int().min(0).max(100000).default(0),
        unreadOnly: z.boolean().default(false),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = String(context.userId);
    await requirePermission(user, "dashboard.read", context.bearerToken);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      kind: string;
      entity_id: string;
      created_at: string;
      read: boolean;
    }>(
      "SELECT e.id,e.kind,e.entity_id,e.created_at::text,(r.event_id IS NOT NULL) AS read FROM admin_events e LEFT JOIN admin_event_reads r ON r.event_id=e.id AND r.user_id=$1 WHERE NOT $2 OR r.event_id IS NULL ORDER BY e.created_at DESC,e.id LIMIT 24 OFFSET $3",
      [user, data.unreadOnly, data.page * 24],
    );
    const [count] = await sql.query<{ total: number; unread: number }>(
      "SELECT count(*)::int AS total,count(*) FILTER(WHERE r.event_id IS NULL)::int AS unread FROM admin_events e LEFT JOIN admin_event_reads r ON r.event_id=e.id AND r.user_id=$1",
      [user],
    );
    return { rows, total: data.unreadOnly ? count.unread : count.total, unread: count.unread };
  });
export const markAdminNotificationRead = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = String(context.userId);
    await requirePermission(user, "dashboard.read", context.bearerToken);
    await (
      await getSql()
    ).query(
      "INSERT INTO admin_event_reads(event_id,user_id) SELECT id,$2 FROM admin_events WHERE id=$1 ON CONFLICT DO NOTHING",
      [data.id, user],
    );
    return { ok: true };
  });

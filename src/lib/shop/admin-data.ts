import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { configuration, audit, limit } from "./operations-service.server";
import { CommerceError } from "./commerce.server";
const recordKinds = [
  "users",
  "orders",
  "payments",
  "claims",
  "gifts",
  "coupons",
  "audit",
  "transactions",
  "stock",
  "content",
  "jobs",
  "sessions",
  "logins",
] as const;
export type RecordKind = (typeof recordKinds)[number];
const definitions: Record<
  RecordKind,
  { permission: string; query: string; search: string; date: string }
> = {
  users: {
    permission: "users.read",
    query: `SELECT u.id,u.name,u.email,u.image,u."createdAt"::text AS created_at,COALESCE(m.rank,'New Member') AS rank,COALESCE(m.rank_color,'#64748b') AS color,COALESCE(m.disabled,false) AS disabled,COALESCE(w.balance,0) AS balance,(SELECT COALESCE(sum(total),0)::int FROM orders WHERE user_id=u.id AND status='completed') AS spending,(SELECT count(*)::int FROM orders WHERE user_id=u.id) AS orders,(SELECT max(created_at)::text FROM login_history WHERE user_id=u.id AND event='auth.login') AS last_login FROM "user" u LEFT JOIN member_profiles m ON m.user_id=u.id LEFT JOIN wallet_accounts w ON w.user_id=u.id`,
    search: "id,name,email,rank",
    date: "created_at",
  },
  orders: {
    permission: "orders.manage",
    query: `SELECT o.id,o.user_id,o.status,o.total,o.subtotal,o.customer_input,o.created_at::text,o.warranty_end::text,i.product_id,i.product_name FROM orders o JOIN order_items i ON i.order_id=o.id`,
    search: "id,user_id,product_name,status",
    date: "created_at",
  },
  payments: {
    permission: "topups.manage",
    query:
      "SELECT id,user_id,method,amount,fee,credit,status,provider,provider_reference,reject_reason,(slip_evidence IS NOT NULL) AS has_slip,created_at::text FROM payments",
    search: "id,user_id,provider_reference,status",
    date: "created_at",
  },
  claims: {
    permission: "claims.manage",
    query:
      "SELECT c.id,c.order_id,c.user_id,c.title,c.message,c.reply,c.status,c.created_at::text,o.warranty_end::text FROM claims c JOIN orders o ON o.id=c.order_id",
    search: "id,user_id,title,status",
    date: "created_at",
  },
  gifts: {
    permission: "gift_codes.manage",
    query:
      "SELECT id,label,reward,amount,product_id,active,expires_at::text,usage_limit,used,created_at::text FROM gift_codes",
    search: "id,label,reward",
    date: "created_at",
  },
  coupons: {
    permission: "promotions.manage",
    query:
      "SELECT id,code,kind,amount,minimum,product_id,category_id,active,expires_at::text,usage_limit,used,per_user_limit,created_at::text FROM coupons",
    search: "id,code,kind",
    date: "created_at",
  },
  audit: {
    permission: "audit.read",
    query:
      "SELECT id,actor_id,action,entity_type,entity_id,metadata,created_at::text FROM audit_logs",
    search: "id,actor_id,action,entity_id",
    date: "created_at",
  },
  transactions: {
    permission: "wallet.manage",
    query:
      "SELECT id,user_id,order_id,payment_id,kind,status,amount,provider,provider_ref,created_at::text FROM transactions",
    search: "id,user_id,kind,status",
    date: "created_at",
  },
  stock: {
    permission: "stock.manage",
    query:
      "SELECT i.id,i.product_id,p.name,i.status,i.order_id,i.created_at::text,i.sold_at::text FROM inventory_items i JOIN products p ON p.id=i.product_id",
    search: "id,product_id,name,status",
    date: "created_at",
  },
  content: {
    permission: "promotions.manage",
    query:
      "SELECT id,kind,title,body,image,link,audience,priority,active,starts_at::text,ends_at::text,updated_at::text AS created_at FROM content_blocks",
    search: "id,kind,title",
    date: "created_at",
  },
  jobs: {
    permission: "system.manage",
    query:
      "SELECT id,kind,status,attempts,last_error,available_at::text,created_at::text FROM jobs",
    search: "id,kind,status",
    date: "created_at",
  },
  logins: {
    permission: "users.read",
    query: "SELECT id,user_id,event,ip_address,user_agent,created_at::text FROM login_history",
    search: "id,user_id,event",
    date: "created_at",
  },
  sessions: {
    permission: "users.read",
    query:
      'SELECT id,"userId" AS user_id,"createdAt"::text AS created_at,"expiresAt"::text AS expires_at,"ipAddress" AS ip_address,"userAgent" AS user_agent FROM "session"',
    search: "id,user_id",
    date: "created_at",
  },
};
export const adminRecords = createServerFn({ method: "GET" })
  .validator((v: unknown) =>
    z
      .object({
        kind: z.enum(recordKinds),
        search: z.string().max(200).default(""),
        page: z.number().int().min(0).max(100000).default(0),
        size: z.number().int().min(1).max(100).default(30),
        status: z.string().max(80).default(""),
        from: z.string().datetime().nullable().default(null),
        to: z.string().datetime().nullable().default(null),
        descending: z.boolean().default(true),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const definition = definitions[data.kind];
    await requirePermission(String(context.userId), definition.permission, context.bearerToken);
    const sql = await getSql();
    await limit(sql, `admin-read:${context.userId}`, 120);
    // SQL identifiers come exclusively from the fixed definitions, values remain parameters.
    const search = definition.search
      .split(",")
      .map((column) => `COALESCE(${column}::text,'')`)
      .join("||' '||");
    const where = `(${search}) ILIKE $1 AND ($2::timestamptz IS NULL OR ${definition.date}::timestamptz>=$2) AND ($3::timestamptz IS NULL OR ${definition.date}::timestamptz<=$3)`;
    const filteredStatus = data.status ? ` AND row_to_json(records)->>'status'=$6` : "";
    const params: unknown[] = [
      `%${data.search}%`,
      data.from,
      data.to,
      data.size,
      data.page * data.size,
    ];
    if (data.status) params.push(data.status);
    const rows = await sql.query<Record<string, string | number | boolean | null>>(
      `SELECT *,count(*) OVER()::int AS total_rows FROM (${definition.query}) records WHERE ${where}${filteredStatus} ORDER BY ${definition.date} ${data.descending ? "DESC" : "ASC"} NULLS LAST,id LIMIT $4 OFFSET $5`,
      params,
    );
    return { rows, total: Number(rows[0]?.total_rows ?? 0) };
  });
export const dashboardData = createServerFn({ method: "GET" })
  .validator((v: unknown) =>
    z.object({ days: z.number().int().min(1).max(3650).default(30) }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "dashboard.read", context.bearerToken);
    const sql = await getSql();
    const settings = await configuration(sql);
    const [totals] = await sql.query<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM "user") AS members,(SELECT count(*)::int FROM "user" WHERE "createdAt">=now()-$1*interval '1 day') AS new_members,(SELECT count(*)::int FROM products WHERE active=true) AS products,(SELECT COALESCE(sum(stock),0)::int FROM products WHERE active=true) AS stock,(SELECT count(*)::int FROM products WHERE active=true AND stock<=$2) AS low_stock,(SELECT count(*)::int FROM orders WHERE created_at>=now()-$1*interval '1 day') AS orders,(SELECT COALESCE(sum(total),0)::int FROM orders WHERE status='completed' AND created_at>=now()-$1*interval '1 day') AS sales,(SELECT COALESCE(sum(credit),0)::int FROM payments WHERE status='success' AND created_at>=now()-$1*interval '1 day') AS topups,(SELECT COALESCE(sum(balance),0)::bigint FROM wallet_accounts) AS credit,(SELECT count(*)::int FROM orders WHERE status='processing') AS waiting_delivery,(SELECT count(*)::int FROM claims WHERE status IN ('pending','accepted')) AS pending_claims`,
      [data.days, settings.lowStock],
    );
    const chart = await sql.query<{ day: string; sales: number }>(
      "SELECT (created_at AT TIME ZONE 'Asia/Bangkok')::date::text AS day,sum(total)::int AS sales FROM orders WHERE status='completed' AND created_at>=now()-$1*interval '1 day' GROUP BY 1 ORDER BY 1",
      [data.days],
    );
    const best = await sql.query<{ name: string; quantity: number }>(
      "SELECT i.product_name AS name,sum(i.quantity)::int AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='completed' AND o.created_at>=now()-$1*interval '1 day' GROUP BY i.product_name ORDER BY quantity DESC LIMIT 10",
      [data.days],
    );
    const eligible = await sql.query<Record<string, string | number | boolean | null>>(
      `SELECT u.id,u.name,COALESCE(m.rank,'New Member') AS rank,sum(o.total)::int AS spending FROM "user" u JOIN orders o ON o.user_id=u.id AND o.status='completed' LEFT JOIN member_profiles m ON m.user_id=u.id GROUP BY u.id,u.name,m.rank HAVING sum(o.total)>=$1 ORDER BY spending DESC LIMIT 100`,
      [settings.vip],
    );
    return { totals, chart, best, eligible };
  });
export const disableGift = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ id: z.string().min(1).max(200), active: z.boolean() }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "gift_codes.manage", context.bearerToken);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx.query("UPDATE gift_codes SET active=$2 WHERE id=$1", [data.id, data.active]);
      await audit(tx, String(context.userId), "gift.status", "gift", data.id, {
        active: data.active,
      });
    });
    return { ok: true };
  });
export const changeInventoryStatus = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({ id: z.string().min(1).max(200), status: z.enum(["available", "disabled"]) })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "stock.manage", context.bearerToken);
    const sql = await getSql();
    return sql.transaction(async (tx) => {
      const [item] = await tx.query<{ product_id: string }>(
        "SELECT product_id FROM inventory_items WHERE id=$1",
        [data.id],
      );
      if (!item) throw new CommerceError("ไม่พบสต็อก");
      await tx.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [item.product_id]);
      const rows = await tx.query(
        "UPDATE inventory_items SET status=$2 WHERE id=$1 AND status IN ('available','disabled') RETURNING id",
        [data.id, data.status],
      );
      if (!rows.length) throw new CommerceError("สินค้าที่ขายหรือจองแล้วเปลี่ยนสถานะไม่ได้");
      await tx.query(
        "UPDATE products SET stock=(SELECT count(*)::int FROM inventory_items WHERE product_id=$1 AND status='available'),updated_at=now() WHERE id=$1",
        [item.product_id],
      );
      await audit(tx, String(context.userId), "inventory.status", "inventory", data.id, {
        status: data.status,
      });
      return { ok: true };
    });
  });
export const systemHealth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    const sql = await getSql();
    const started = Date.now();
    await sql.query("SELECT 1");
    const [queue] = await sql.query<{ pending: number; failed: number }>(
      "SELECT count(*) FILTER(WHERE status IN ('pending','retry'))::int AS pending,count(*) FILTER(WHERE status='dead_letter')::int AS failed FROM jobs",
    );
    return {
      checkedAt: new Date().toISOString(),
      database: {
        status: process.env.DATABASE_URL ? "healthy" : "warning",
        milliseconds: Date.now() - started,
      },
      payment: {
        status:
          process.env.SLIP2GO_API_SECRET && process.env.SLIP2GO_VERIFY_URL
            ? "configured-unverified"
            : "requires-credentials",
      },
      google: {
        status:
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? "configured-unverified"
            : "requires-credentials",
      },
      inventory: {
        status: /^[a-f\d]{64}$/i.test(process.env.INVENTORY_ENCRYPTION_KEY ?? "")
          ? "configured"
          : "requires-key",
      },
      storage: { status: "database" },
      queue,
      scheduler: {
        configured: Boolean(process.env.CRON_SECRET),
        schedule: "ทุกวันช่วง 09:00 น. ประเทศไทย",
        recent: await sql.query<{
          kind: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          result: { processed?: number };
        }>(
          "SELECT kind,status,started_at::text,finished_at::text,result FROM system_runs ORDER BY started_at DESC LIMIT 5",
        ),
      },
      backup: {
        configured: /^[a-f\d]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY ?? ""),
        everyHours: Number(process.env.BACKUP_EVERY_HOURS) || null,
      },
      email: {
        status:
          process.env.RESEND_API_KEY && process.env.EMAIL_FROM
            ? "configured-unverified"
            : "requires-credentials",
      },
      version: "0.4.0",
      migration: "0012",
      realtime: "SSE ตรวจการเปลี่ยนแปลงทุก 5 วินาที / polling สำรอง 15 วินาที",
    };
  });

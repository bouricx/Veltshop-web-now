import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
export const storefrontSummary = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const [stats] = await sql.query<{
    members: number;
    stock: number;
    topups: number;
    ready: number;
  }>(
    `SELECT (SELECT count(*)::int FROM "user") AS members,(SELECT COALESCE(sum(stock),0)::int FROM products WHERE active=true) AS stock,(SELECT count(*)::int FROM payments WHERE status='success') AS topups,(SELECT count(*)::int FROM products WHERE active=true AND stock>0) AS ready`,
  );
  const latest = await sql.query<{
    id: string;
    product: string;
    buyer: string;
    created_at: string;
  }>(
    `SELECT id,product,buyer,created_at::text FROM (
      SELECT 'order:' || o.id AS id,string_agg(i.product_name, ', ' ORDER BY i.id) AS product,
        CASE WHEN trim(u.name)<>'' AND position('@' IN u.name)=0 THEN left(trim(u.name),2)||'***' ELSE 'สมาชิก' END AS buyer,
        o.updated_at AS created_at
      FROM orders o JOIN order_items i ON i.order_id=o.id JOIN "user" u ON u.id=o.user_id
      WHERE o.status='completed' GROUP BY o.id,u.name
      UNION ALL
      SELECT 'cart:' || r.id,(SELECT string_agg(item->>'name', ', ' ORDER BY ordinal)
        FROM jsonb_array_elements(r.items) WITH ORDINALITY AS entries(item,ordinal)),
        CASE WHEN trim(u.name)<>'' AND position('@' IN u.name)=0 THEN left(trim(u.name),2)||'***' ELSE 'สมาชิก' END,
        r.delivered_at
      FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id JOIN "user" u ON u.id=r.user_id
      WHERE r.status='done' AND p.status='paid' AND r.delivered_at IS NOT NULL
    ) purchases ORDER BY created_at DESC,id DESC LIMIT 7`,
  );
  return { stats, latest };
});

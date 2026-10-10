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
  const latest = await sql.query<{ id: string; product: string; created_at: string }>(
    "SELECT o.id,i.product_name AS product,o.created_at::text FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.status='completed' ORDER BY o.created_at DESC LIMIT 7",
  );
  return { stats, latest };
});

import type { Sql } from "../db";
/** Pending discounted carts retain a use until cancelled, including late bank transfers. */
export async function cartCouponUsage(sql: Sql, couponId: string, user: string) {
  const [usage] = await sql.query<{ n: number; own: number }>(
    `SELECT count(*)::int n,count(*) FILTER (WHERE r.user_id=$2)::int own
   FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
   WHERE r.items->0->>'couponId'=$1 AND r.status<>'cancelled'`,
    [couponId, user],
  );
  return usage;
}

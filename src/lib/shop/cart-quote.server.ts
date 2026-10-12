import { cartCouponUsage } from "./coupon-usage.server.ts";
import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import type { CartQuote } from "./cart-quote.ts";
export type { CartQuote } from "./cart-quote.ts";
/** Caller owns the transaction; lock order matches wallet checkout: coupon, products. */
export async function quoteCart(
  tx: Sql,
  user: string,
  lines: { productId: string; quantity: number }[],
  code = "",
): Promise<CartQuote> {
  if (
    !lines.length ||
    lines.length > 30 ||
    new Set(lines.map((i) => i.productId)).size !== lines.length ||
    lines.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)
  )
    throw new CommerceError("รายการสินค้าไม่ถูกต้อง");
  const couponCode = code.trim().toUpperCase();
  const [coupon] = couponCode
    ? await tx.query<{
        id: string;
        kind: string;
        amount: number;
        minimum: number;
        product_id: string | null;
        category_id: string | null;
        per_user_limit: number;
        used: number;
        usage_limit: number;
      }>(
        "SELECT * FROM coupons WHERE code=$1 AND active AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE",
        [couponCode],
      )
    : [];
  if (couponCode && !coupon) throw new CommerceError("โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ");
  if (coupon) {
    // A discounted request holds its coupon use until explicit cancellation.
    // Expired transfers can still be manually reviewed; releasing at expiry could oversell uses.
    const cartUsage = await cartCouponUsage(tx, coupon.id, user);
    const [legacyUsage] = await tx.query<{ n: number }>(
      "SELECT count(*)::int n FROM coupon_uses WHERE coupon_id=$1 AND user_id=$2",
      [coupon.id, user],
    );
    if (coupon.used + cartUsage.n >= coupon.usage_limit)
      throw new CommerceError("โค้ดนี้ถูกใช้ครบสิทธิ์แล้ว");
    if (legacyUsage.n + cartUsage.own >= coupon.per_user_limit)
      throw new CommerceError("คุณใช้โค้ดนี้ครบสิทธิ์แล้ว");
  }
  const products = await tx.query<{
    id: string;
    price: number;
    category_id: string;
    warranty_days: number;
    active: boolean;
  }>(
    "SELECT id,price,category_id,warranty_days,active FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
    [lines.map((i) => i.productId)],
  );
  const items = lines.map((i) => {
    const p = products.find((p) => p.id === i.productId);
    if (!p?.active) throw new CommerceError("มีสินค้าที่ไม่ได้เปิดขาย กรุณานำออกจากตะกร้า");
    if (!Number.isSafeInteger(p.price) || p.price < 0)
      throw new CommerceError("ราคาสินค้าไม่ถูกต้อง");
    return { ...i, price: p.price, lineTotal: p.price * i.quantity, warrantyDays: p.warranty_days };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647)
    throw new CommerceError("ยอดรายการสูงเกินไป");
  let discount = 0;
  if (coupon) {
    if (subtotal < coupon.minimum) throw new CommerceError("ยอดไม่ถึงขั้นต่ำของโค้ดส่วนลด");
    const eligible = items.filter((i) => {
      const p = products.find((p) => p.id === i.productId)!;
      return (
        (!coupon.product_id || coupon.product_id === i.productId) &&
        (!coupon.category_id || coupon.category_id === p.category_id)
      );
    });
    const eligibleTotal = eligible.reduce((n, i) => n + i.lineTotal, 0);
    if (!eligibleTotal) throw new CommerceError("โค้ดนี้ไม่ตรงกับสินค้าในตะกร้า");
    discount = Math.min(
      eligibleTotal,
      coupon.kind === "percent"
        ? Math.floor((eligibleTotal * Math.min(100, coupon.amount)) / 100)
        : coupon.amount,
    );
    let remaining = discount;
    eligible.forEach((i, index) => {
      const reduction =
        index === eligible.length - 1
          ? remaining
          : Math.floor((discount * i.lineTotal) / eligibleTotal);
      i.lineTotal -= reduction;
      remaining -= reduction;
    });
  }
  if (coupon && subtotal - discount < 1)
    throw new CommerceError("โค้ดนี้ลดจนยอดเป็นศูนย์ กรุณาใช้โค้ดรับสินค้าแทนการชำระ QR");
  return { items, subtotal, discount, total: subtotal - discount, coupon: couponCode };
}

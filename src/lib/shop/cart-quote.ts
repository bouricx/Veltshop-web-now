export type CartQuote = {
  items: {
    productId: string;
    quantity: number;
    price: number;
    lineTotal: number;
    warrantyDays: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: string;
};
export function sameQuote(a: CartQuote | undefined, b: CartQuote) {
  return Boolean(
    a &&
    a.total === b.total &&
    a.discount === b.discount &&
    a.coupon === b.coupon &&
    a.items.length === b.items.length &&
    b.items.every((i) =>
      a.items.some(
        (j) =>
          j.productId === i.productId &&
          j.quantity === i.quantity &&
          j.price === i.price &&
          j.lineTotal === i.lineTotal,
      ),
    ),
  );
}

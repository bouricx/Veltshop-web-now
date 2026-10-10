import { onShopChange } from "@/lib/shop/realtime-client";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listProducts } from "@/lib/shop/actions";
import type { Product } from "@/lib/shop/catalog";
import { formatBaht } from "@/lib/utils";
export function FlashSale() {
  const [item, setItem] = useState<Product | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      void listProducts()
        .then((rows) => {
          if (active) setItem(rows.find((p) => p.flash && p.stock > 0) ?? null);
        })
        .catch(() => {});
    load();
    const unsubscribe = onShopChange(load);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  if (!item) return null;
  return (
    <section className="mb-8 overflow-hidden rounded-xl bg-surface shadow-border sm:grid sm:grid-cols-2">
      <img src={item.image} alt={item.name} className="h-44 w-full object-cover" />
      <div className="p-5">
        <p className="text-xs text-warn">Flash Sale</p>
        <h2 className="mt-2 text-2xl font-semibold">{item.name}</h2>
        <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
        <p className="mt-4 text-3xl">{formatBaht(item.price)}</p>
        <p className="text-xs text-muted">เหลือ {item.stock} ชิ้น</p>
        <Link
          className="mt-4 inline-block underline"
          to="/shop/catalog"
          search={{ cat: item.category }}
        >
          ดูสินค้า
        </Link>
      </div>
    </section>
  );
}

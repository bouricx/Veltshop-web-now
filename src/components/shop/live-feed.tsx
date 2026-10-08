import { useEffect, useState } from "react";
import { fakeBuyers, products } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";
import { relativeTime } from "@/lib/utils";

type FeedItem = { id: string; name: string; product: string; at: number };

function mask(name: string) {
  const clean = name.replace(/\s/g, "");
  if (clean.length <= 2) return `${clean[0]}**`;
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

function seed(): FeedItem[] {
  return Array.from({ length: 7 }, (_, i) => {
    const product = products[i % products.length];
    return {
      id: `seed-${i}`,
      name: fakeBuyers[i % fakeBuyers.length],
      product: product.name,
      at: Date.now() - (i + 1) * 38000,
    };
  });
}

export function LiveFeed() {
  const orders = useShop((s) => s.orders);
  const [fake, setFake] = useState<FeedItem[]>([]);

  useEffect(() => {
    setFake(seed());
    const id = setInterval(() => {
      const product = products[Math.floor(Math.random() * products.length)];
      const name = fakeBuyers[Math.floor(Math.random() * fakeBuyers.length)];
      setFake((prev) =>
        [{ id: `${Date.now()}`, name, product: product.name, at: Date.now() }, ...prev].slice(0, 8),
      );
    }, 7000);
    return () => clearInterval(id);
  }, []);

  const live = [
    ...orders
      .filter((o) => o.kind === "product")
      .slice(0, 3)
      .map((o) => ({ id: o.id, name: "คุณ", product: o.name, at: o.at })),
    ...fake,
  ].slice(0, 7);

  return (
    <aside className="rounded-3xl bg-surface p-5 shadow-border">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">ประวัติสั่งซื้อล่าสุด</p>
          <p className="text-xs text-muted">อัปเดตแบบ Real-time</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2.5 py-1 text-xs font-medium text-ok">
          <span className="size-1.5 rounded-full bg-ok" />
          Live
        </span>
      </div>
      <ul className="divide-y divide-border">
        {live.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft text-xs font-semibold text-accent">
              {item.product.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.product}</p>
              <p className="truncate text-xs text-muted">{mask(item.name)}</p>
            </div>
            <p className="shrink-0 text-xs text-subtle">{relativeTime(item.at)}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

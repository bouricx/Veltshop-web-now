import { useEffect, useState } from "react";
import { products } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";
import { formatBaht } from "@/lib/utils";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function FlashSale() {
  const endsAt = useShop((s) => s.flashEndsAt);
  const stock = useShop((s) => s.flashStock);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? 0 : Math.max(0, endsAt - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const item = products.find((p) => p.flash && p.id === "gem-flash");
  if (!item) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-xl bg-surface shadow-border sm:grid sm:grid-cols-2">
      <img src={item.image} alt="" className="h-44 w-full object-cover sm:h-full" />
      <div className="p-5 sm:p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-warn uppercase">Flash Sale</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{item.name}</h2>
        <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
        <div className="mt-4 flex items-end gap-3">
          <p className="tabular text-3xl font-medium">{formatBaht(item.price)}</p>
          {item.compareAt ? (
            <p className="tabular pb-1 text-sm text-subtle line-through">{formatBaht(item.compareAt)}</p>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">เหลือ {stock} ชิ้น · หมดแล้วหมดเลย</p>
        <div className="mt-4 flex gap-2 font-mono text-lg">
          <TimeBox label="ชม." value={now === null ? "--" : pad(h)} />
          <TimeBox label="นาที" value={now === null ? "--" : pad(m)} />
          <TimeBox label="วินาที" value={now === null ? "--" : pad(s)} />
        </div>
      </div>
    </section>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-bg px-3 py-2 text-center shadow-border">
      <p className="tabular leading-none">{value}</p>
      <p className="mt-1 text-xs tracking-wide text-subtle uppercase">{label}</p>
    </div>
  );
}

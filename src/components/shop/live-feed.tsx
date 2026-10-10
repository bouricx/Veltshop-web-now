import { onShopChange } from "@/lib/shop/realtime-client";
import { useEffect, useState } from "react";
import { storefrontSummary } from "@/lib/shop/storefront";
import { relativeTime } from "@/lib/utils";
export function LiveFeed() {
  const [live, setLive] = useState<Awaited<ReturnType<typeof storefrontSummary>>["latest"]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      void storefrontSummary()
        .then((value) => {
          if (active) setLive(value.latest);
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
  return (
    <aside className="rounded-3xl bg-surface p-5 shadow-border">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">ประวัติสั่งซื้อล่าสุด</p>
          <p className="text-xs text-muted">รายการซื้อที่สำเร็จล่าสุด</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2.5 py-1 text-xs font-medium text-ok">
          <span className="size-1.5 rounded-full bg-ok" />
          อัปเดตสด
        </span>
      </div>
      {!live.length ? <p className="py-6 text-sm text-muted">ยังไม่มีรายการซื้อสำเร็จ</p> : null}
      <ul className="divide-y divide-border">
        {live.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft text-xs font-semibold text-accent">
              {item.product.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.product}</p>
              <p className="truncate text-xs text-muted">ซื้อสำเร็จ</p>
            </div>
            <p className="shrink-0 text-xs text-subtle">
              {relativeTime(new Date(item.created_at).getTime())}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

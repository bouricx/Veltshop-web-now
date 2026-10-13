import { useEffect, useId, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductMark } from "./product-mark";
import { listCategories, listProducts, type CategoryRow } from "@/lib/shop/actions";
import type { Product } from "@/lib/shop/catalog";
import { onShopChange } from "@/lib/shop/realtime-client";
import { useShop } from "@/lib/shop/store";
import { formatBaht } from "@/lib/utils";

export function ProductShowcase() {
  const headingId = useId();
  const flags = useShop((state) => state.navFlags);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true, fetching = false;
    async function load() {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const [items, groups] = await Promise.all([listProducts(), listCategories()]);
        if (active) {
          setProducts(items);
          setCategories(groups);
          setError(false);
        }
      } catch {
        if (active) {
          setProducts([]);
          setError(true);
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const unsubscribe = onShopChange(() => void load());
    const timer = setInterval(() => void load(), 30000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [revision]);

  const labels = new Map(categories.filter((category) =>
    !(category.id === "stream" && !flags.streaming) &&
    !(category.id === "otp" && !flags.otp) &&
    !(category.id === "smm" && !flags.smm),
  ).map((category) => [category.id, category.label]));
  const visible = products.filter((product) => product.active !== false && labels.has(product.category)).slice(0, 24);
  // Repeat short catalogs enough to cover the viewport, then duplicate the
  // complete strip for a seamless loop. Copies skip keyboard/AT navigation
  // while remaining clickable whenever they move into the visible viewport.
  const repeats = visible.length ? Math.max(1, Math.ceil(6 / visible.length)) : 0;
  const strip = Array.from({ length: repeats }, () => visible).flat();

  return (
    <section aria-labelledby={headingId} className="product-showcase rounded-3xl border border-border py-5 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles className="size-3.5 text-icon-purple" aria-hidden="true" /> ค้นพบของที่ใช่
          </p>
          <h2 id={headingId} className="text-xl font-semibold tracking-tight">ร้านนี้มีอะไรบ้าง?</h2>
          <p className="mt-1 text-xs text-muted">เลือกสินค้าเพื่อดูรายละเอียดและเงื่อนไข</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/shop/catalog" search={{ cat: "all" }} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
            ดูทั้งหมด <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      {loading ? (
        <div role="status" aria-label="กำลังโหลดสินค้าจากร้าน" className="flex gap-4 overflow-hidden px-5">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-64 w-52 shrink-0 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="px-5 text-sm text-muted" role="status">
          โหลดสินค้าไม่สำเร็จ <Button type="button" size="sm" variant="ghost" onClick={() => setRevision((value) => value + 1)}>ลองใหม่</Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">ร้านกำลังเตรียมสินค้า ดูรายการล่าสุดได้ที่หน้าสินค้า</p>
      ) : (
        <div className="showcase-viewport">
          <div className="showcase-track" style={{ "--showcase-duration": `${Math.max(30, strip.length * 5)}s` } as CSSProperties}>
            {[0, 1].map((copy) => (
              <ul key={copy} className="showcase-strip" aria-hidden={copy === 1 ? true : undefined}>
                {strip.map((product, index) => (
                  <li key={`${product.id}:${index}`} aria-hidden={index >= visible.length ? true : undefined}>
                    <Link
                      to="/shop/product/$id"
                      params={{ id: product.id }}
                      tabIndex={copy === 1 || index >= visible.length ? -1 : undefined}
                      className="product-theme-preview showcase-card block overflow-hidden rounded-2xl border text-fg"
                      style={{ "--product-color": product.cardColor ?? "#2563eb", "--product-border": product.borderColor ?? product.cardColor ?? "#2563eb" } as CSSProperties}
                    >
                      <div className="relative m-2 grid h-32 place-items-center overflow-hidden rounded-xl sm:h-36">
                        <ProductMark name={product.name} color={product.cardColor} className="size-14 text-2xl" />
                        <img key={product.image} src={product.image} alt="" width={400} height={400} loading={copy === 0 && index < 6 ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />
                      </div>
                      <div className="px-3 pb-3">
                        <p className="truncate text-[0.6875rem] text-muted">{labels.get(product.category)}</p>
                        <h3 className="mt-1 min-h-10 text-sm font-semibold leading-5 line-clamp-2">{product.name}</h3>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                          <span className="tabular text-base font-bold">{formatBaht(product.price)}</span>
                          <span className="text-[0.6875rem] text-muted">{product.stock > 0 ? "พร้อมสั่ง" : "รอตรวจสต็อก"}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

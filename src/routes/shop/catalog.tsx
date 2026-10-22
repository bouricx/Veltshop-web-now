import { createFileRoute } from "@tanstack/react-router";
import { ProductGrid } from "@/components/shop/product-grid";
import { categories } from "@/lib/shop/catalog";
import { Check, Search, ShoppingBag, ShieldCheck } from "lucide-react";
import { CheckoutGuide } from "@/components/shop/checkout-guide";

export const Route = createFileRoute("/shop/catalog")({
  validateSearch: (raw: Record<string, unknown>) => ({
    cat: typeof raw.cat === "string" ? raw.cat : undefined,
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { cat } = Route.useSearch();
  const current = cat || "all";
  const label = categories.find((c) => c.id === current)?.label ?? "สินค้าทั้งหมด";

  return (
    <div>
      <section className="catalog-intro rounded-3xl border border-border bg-surface p-5 shadow-border sm:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-sm">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
                VELTSHOP · เลือกสินค้า
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{label}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                ค้นพบสินค้าแบบที่ชอบ เลือกจำนวนช่องที่ถนัด แล้วเพิ่มลงตะกร้าได้ทันที
              </p>
            </div>
          </div>
          <div className="catalog-trust-row flex flex-wrap gap-2 text-xs text-muted" aria-label="จุดเด่นการสั่งซื้อ">
            <span><Search className="size-3.5" aria-hidden="true" /> ค้นหาไว</span>
            <span><ShieldCheck className="size-3.5" aria-hidden="true" /> ตรวจสลิป</span>
            <span><Check className="size-3.5" aria-hidden="true" /> ติดตามสถานะ</span>
          </div>
        </div>
      </section>
      <div className="mt-6">
        <CheckoutGuide />
      </div>
      <div className="mt-6">
        <ProductGrid initialCat={current} />
      </div>
    </div>
  );
}

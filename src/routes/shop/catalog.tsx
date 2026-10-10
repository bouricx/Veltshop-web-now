import { createFileRoute } from "@tanstack/react-router";
import { ProductGrid } from "@/components/shop/product-grid";
import { categories } from "@/lib/shop/catalog";
import { ShoppingBag } from "lucide-react";

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
            ดูราคาและสถานะสินค้า แล้วกดเพิ่มลงตะกร้าได้เลย ร้านจะตรวจสอบและยืนยันรายการให้ก่อน
            ไม่มีการชำระเงินในขั้นตอนนี้
          </p>
        </div>
      </div>
      <div className="mt-6">
        <ProductGrid initialCat={current} />
      </div>
    </div>
  );
}

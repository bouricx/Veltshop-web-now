import { createFileRoute } from "@tanstack/react-router";
import { ProductGrid } from "@/components/shop/product-grid";
import { categories } from "@/lib/shop/catalog";

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
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">สินค้า</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{label}</h1>
      <p className="mt-2 text-sm text-muted">เลือกหมวดสินค้าและตรวจสอบรายละเอียดก่อนสั่งซื้อ</p>
      <div className="mt-6">
        <ProductGrid initialCat={current} />
      </div>
    </div>
  );
}

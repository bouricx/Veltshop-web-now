import { useCart } from "@/lib/shop/cart-store";
import { contrastText, selectProducts, type CatalogSort } from "@/lib/shop/presentation";
import { useSiteConfiguration } from "@/lib/shop/site-state";
import { onShopChange } from "@/lib/shop/realtime-client";
import { useEffect, useMemo, useState, useId, type CSSProperties, type ReactNode } from "react";
import {
  Flame,
  Pencil,
  Search,
  ShoppingBag,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { CategoryEditor } from "@/components/shop/category-editor";
import { ProductEditor } from "@/components/shop/product-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import {
  listCategories,
  listProducts,
  type CategoryRow,
} from "@/lib/shop/actions";
import { getAdminStatus } from "@/lib/shop/admin-gate";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { Product } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";
import { cn, formatBaht } from "@/lib/utils";

export function ProductGrid({
  initialCat = "all",
  onlyProductId,
  featuredOnly = false,
}: {
  initialCat?: string;
  onlyProductId?: string;
  featuredOnly?: boolean;
}) {
  const searchId = useId();
  const [sort, setSort] = useState<CatalogSort>("recommended");
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const flags = useShop((s) => s.navFlags);
  const [cat, setCat] = useState<string>(initialCat);
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCats, setEditingCats] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    setCat(initialCat);
  }, [initialCat]);

  useEffect(() => {
    if (isPending) return;
    if (!user || user.isDevFallback) {
      setIsAdmin(false);
      return;
    }
    void getAdminStatus()
      .then((s) => setIsAdmin(Boolean(s.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [user, isPending]);

  async function reload() {
    try {
      const [p, c] = await Promise.all([listProducts(), listCategories()]);
      setItems(p);
      setCats(c);
      setError("");
    } catch {
      setError("โหลดสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [p, c] = await Promise.all([listProducts(), listCategories()]);
        if (active) {
          setItems(p);
          setCats(c);
          setError("");
        }
      } catch {
        if (active) setError("โหลดสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const unsubscribe = onShopChange(() => void load());
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    setPage(1);
  }, [cat, search, sort, inStock, featuredOnly]);

  const list = useMemo(() => {
    const visible = cats.filter((c) => {
      if (c.id === "stream" && !flags.streaming) return false;
      if (c.id === "otp" && !flags.otp) return false;
      if (c.id === "smm" && !flags.smm) return false;
      return true;
    });
    return {
      visible,
      items: selectProducts(items, {
        category: cat,
        query: search,
        sort,
        inStock,
        categories: visible,
        onlyProductId,
        featuredOnly,
      }),
    };
  }, [cat, flags, items, cats, search, onlyProductId, sort, inStock, featuredOnly]);
  const pageSize = featuredOnly ? 3 : 12;
  const pages = Math.max(1, Math.ceil(list.items.length / pageSize));
  const currentPage = Math.min(page, pages);
  const displayed = list.items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="min-w-0">
      {!featuredOnly && !onlyProductId ? (
        <div className="catalog-controls space-y-4 rounded-3xl bg-surface p-4 sm:p-5 shadow-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor={searchId}>ค้นหาสินค้า</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-3 size-5 text-subtle" />
                <Input
                  id={searchId}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ชื่อสินค้า หมวด รายละเอียด หรือรหัส"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor={`${searchId}-sort`}>เรียงสินค้า</Label>
              <NativeSelect
                id={`${searchId}-sort`}
                className="mt-2"
                value={sort}
                onChange={(e) => setSort(e.target.value as CatalogSort)}
              >
                <option value="recommended">แนะนำ</option>
                <option value="price-asc">ราคา: น้อยไปมาก</option>
                <option value="price-desc">ราคา: มากไปน้อย</option>
                <option value="name">ชื่อสินค้า</option>
                <option value="stock">จำนวนพร้อมขาย</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CatChip active={cat === "all"} onClick={() => setCat("all")}>
              ทั้งหมด
            </CatChip>
            {list.visible.map((c) => (
              <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.image ? (
                  <img src={c.image} alt="" className="mr-1 inline size-5 rounded object-cover" />
                ) : c.icon ? (
                  <span className="mr-1">{c.icon}</span>
                ) : (
                  <span
                    className="mr-2 inline-block size-2 rounded-full"
                    style={{ background: c.color ?? "#71717a" }}
                  />
                )}
                {c.label}
              </CatChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="flex min-h-10 items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="size-4 accent-current"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
              />
              เฉพาะสินค้าพร้อมขาย
            </label>
            <p className="text-xs text-muted" aria-live="polite">
              พบ {list.items.length} รายการ
            </p>
            {isAdmin ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditingCats(true)}>
                  แก้หมวด
                </Button>
                <Button size="sm" onClick={() => setCreating(true)}>
                  เพิ่มสินค้า
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            ลองอีกครั้ง
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div
          role="status"
          aria-label="กำลังโหลดสินค้า"
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2].map((n) => (
            <div key={n} className="overflow-hidden rounded-3xl bg-surface shadow-border">
              <div className="skeleton h-48" />
              <div className="space-y-3 p-5">
                <div className="skeleton h-5 w-2/3 rounded" />
                <div className="skeleton h-4 w-1/2 rounded" />
                <div className="skeleton h-11 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : list.items.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-surface px-6 py-12 text-center shadow-border">
          <p className="font-medium">
            {featuredOnly
              ? "สินค้าคัดสรรจะปรากฏที่นี่"
              : items.length === 0
                ? "ยังไม่มีสินค้าในร้าน"
                : "ไม่พบสินค้าที่ตรงกับการค้นหา"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {items.length === 0
              ? "ร้านกำลังเตรียมสินค้า สามารถติดต่อทีมงานเพื่อสอบถามได้"
              : "ลองเปลี่ยนคำค้น หมวดสินค้า หรือตัวกรองพร้อมขาย"}
          </p>
          {isAdmin ? (
            <Button className="mt-5 rounded-full" onClick={() => setCreating(true)}>
              เพิ่มสินค้า
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="stagger-in mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {displayed.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              canEdit={isAdmin}
              onEdit={() => setEditing(p)}
            />
          ))}
        </div>
      )}
      {!featuredOnly && pages > 1 ? (
        <nav aria-label="หน้ารายการสินค้า" className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ก่อนหน้า
          </Button>
          <span className="text-sm text-muted" aria-live="polite">
            {currentPage} / {pages}
          </span>
          <Button
            variant="secondary"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            ถัดไป
          </Button>
        </nav>
      ) : null}
      {isAdmin ? (
        <>
          <ProductEditor
            open={Boolean(editing) || creating}
            product={creating ? null : editing}
            onOpenChange={(v) => {
              if (!v) {
                setEditing(null);
                setCreating(false);
              }
            }}
            onSaved={() => void reload()}
          />
          <CategoryEditor
            open={editingCats}
            onOpenChange={setEditingCats}
            onSaved={() => void reload()}
          />
        </>
      ) : null}
    </div>
  );
}

function CatChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-10 shrink-0 rounded-full px-4 text-sm",
        active ? "bg-accent text-accent-fg" : "bg-surface text-muted shadow-border hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
  canEdit,
  onEdit,
}: {
  product: Product;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const lowStock = useSiteConfiguration((s) => s.value.lowStock);
  const theme = product.cardColor ?? "#18181b";
  const accent = product.accentColor ?? theme;
  const badge = product.badgeColor ?? accent;

  return (
    <>
      <article
        style={
          {
            "--product-color": theme,
            "--product-accent": accent,
            borderColor: `${product.borderColor ?? theme}45`,
          } as CSSProperties
        }
        className="product-card group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface"
      >
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-surface text-fg shadow-border"
            aria-label="แก้ไขสินค้า"
          >
            <Pencil className="size-4" />
          </button>
        ) : null}
        <div className="product-art relative aspect-square overflow-hidden p-3">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={800}
            height={800}
            className="product-image h-full w-full rounded-2xl bg-white object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute top-5 left-5 right-14 flex flex-wrap gap-1.5">
            {product.badge ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium shadow-sm"
                style={{ background: badge, color: contrastText(badge) }}
              >
                {product.badge}
              </span>
            ) : null}
            {product.flash ? (
              <Badge tone="amber" className="gap-1 font-semibold shadow-xs">
                <Flame className="size-3 fill-amber-500 text-amber-500" /> โปรโมชัน
              </Badge>
            ) : null}
            {product.compareAt && product.compareAt > product.price ? (
              <Badge tone="danger" className="font-bold shadow-xs">
                -{Math.round(((product.compareAt - product.price) / product.compareAt) * 100)}%
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 pt-2">
          <h3 className="font-semibold tracking-tight">
            {product.icon ? <span className="mr-2">{product.icon}</span> : null}
            {product.name}
          </h3>
          <p className="mt-1 text-sm text-muted line-clamp-1">{product.subtitle}</p>
          <div className="product-price-row mt-4 flex items-end justify-between border-t border-border/40 pt-3">
            <div>
              <p className="product-price tabular text-xl font-bold tracking-tight text-fg">
                {formatBaht(product.price)}
              </p>
              {product.compareAt ? (
                <p className="tabular text-xs text-subtle line-through">
                  {formatBaht(product.compareAt)}
                </p>
              ) : null}
            </div>
            <div>
              {product.stock > lowStock ? (
                <span className="product-stock inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> มีของ ({product.stock})
                </span>
              ) : product.stock > 0 ? (
                <span className="product-stock inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <span className="size-1.5 rounded-full bg-amber-500" /> เหลือ {product.stock}
                </span>
              ) : (
                <span className="product-stock inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
                  <span className="size-1.5 rounded-full bg-rose-400" /> รอร้านตรวจสอบความพร้อม
                </span>
              )}
            </div>
          </div>
          <Button
            className={cn(
              "product-action mt-4 w-full rounded-full gap-2 font-medium transition-all",
              product.stock > 0 ? "hover:opacity-90" : "",
            )}
            style={{ background: accent, color: contrastText(accent) }}
            onClick={() => { if(useCart.getState().add(product))toast.success("เพิ่มลงตะกร้าแล้ว · ยังไม่ต้องชำระเงิน");else toast.error("เพิ่มไม่ได้ จำนวนถึงขีดจำกัดตะกร้าแล้ว"); }}
          >
            <ShoppingBag className="size-4" />
            เพิ่มลงตะกร้า
            <ArrowRight className="ml-auto size-4" />
          </Button>

        </div>
      </article>

    </>
  );
}

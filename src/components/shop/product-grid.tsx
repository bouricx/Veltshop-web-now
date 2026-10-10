import { contrastText, selectProducts, type CatalogSort } from "@/lib/shop/presentation";
import { useSiteConfiguration } from "@/lib/shop/site-state";
import { onShopChange } from "@/lib/shop/realtime-client";
import { getMyDelivery } from "@/lib/shop/inventory";
import { useEffect, useMemo, useState, useId, type CSSProperties, type ReactNode } from "react";
import {
  CheckCircle2,
  Flame,
  Pencil,
  Search,
  ShoppingBag,
  Wallet,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { LoginDialog } from "@/components/login-dialog";
import { CategoryEditor } from "@/components/shop/category-editor";
import { ProductEditor } from "@/components/shop/product-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import {
  checkoutProduct,
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
              onBought={() => void reload()}
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
  onBought,
}: {
  product: Product;
  canEdit: boolean;
  onEdit: () => void;
  onBought: () => void;
}) {
  const [open, setOpen] = useState(false);
  const lowStock = useSiteConfiguration((s) => s.value.lowStock);
  const theme = product.cardColor ?? "#18181b";
  const accent = product.accentColor ?? theme;
  const badge = product.badgeColor ?? accent;
  const { user } = useCurrentUserState();

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
                <Flame className="size-3 fill-amber-500 text-amber-500" /> Flash Sale
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
                  <span className="size-1.5 rounded-full bg-rose-400" /> สินค้าหมด
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
            onClick={() => setOpen(true)}
            disabled={product.stock <= 0}
          >
            <ShoppingBag className="size-4" />
            {product.stock <= 0 ? "สินค้าหมดชั่วคราว" : "สั่งซื้อทันที"}
            <ArrowRight className="ml-auto size-4" />
          </Button>
        </div>
      </article>
      <BuyDialog
        key={user?.id ?? "signed-out"}
        product={product}
        open={open}
        onOpenChange={setOpen}
        onBought={onBought}
      />
    </>
  );
}

function BuyDialog({
  product,
  open,
  onOpenChange,
  onBought,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBought: () => void;
}) {
  const loggedIn = useShop((s) => s.loggedIn);
  const balance = useShop((s) => s.balance);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [uid, setUid] = useState("");
  const [coupon, setCoupon] = useState("");
  const [delivered, setDelivered] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRequestKey(null);
      setResult(null);
      setDelivered(false);
      setUid("");
      setCoupon("");
    }
  }, [open, product.id]);

  async function purchase() {
    if (!coupon.trim() && balance < product.price) {
      toast.error("ยอดเงินไม่พอ เติมเงินก่อนได้ที่เมนูเติมเงิน");
      return;
    }
    setBusy(true);
    const key = requestKey ?? crypto.randomUUID();
    setRequestKey(key);
    try {
      const res = await checkoutProduct({
        data: {
          id: product.id,
          idempotencyKey: key,
          coupon: coupon || undefined,
          customerInput: uid,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      useShop.setState({ balance: res.balance });
      setResult(`${res.message}\nหมายเลขคำสั่งซื้อ: ${res.orderId}`);
      if (res.status === "completed") {
        const delivery = await getMyDelivery({ data: { orderId: res.orderId } });
        if (delivery.ok) {
          setResult(delivery.payload);
          setDelivered(true);
        } else
          setResult(
            `คำสั่งซื้อสำเร็จแล้ว โปรดเปิดสินค้าจากประวัติการซื้อ\nหมายเลขคำสั่งซื้อ: ${res.orderId}`,
          );
      }
      toast.success(res.message);
      onBought();
    } catch {
      toast.error("ตรวจสอบคำสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const remaining = balance - product.price;
  const canAfford = remaining >= 0 || Boolean(coupon.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent title={product.name} className="max-h-[90dvh] overflow-y-auto">
        {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-500 text-white">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {delivered ? "จัดส่งสินค้าสำเร็จแล้ว" : "รับคำสั่งซื้อแล้ว · รอจัดส่ง"}
              </p>
              <p className="text-xs text-subtle mt-0.5">บันทึกลงในประวัติการสั่งซื้อของคุณแล้ว</p>
            </div>
            <div>
              <Label className="text-xs text-subtle mb-1 block">รายละเอียดคำสั่งซื้อ:</Label>
              <div className="rounded-xl border border-border/60 bg-surface-2 p-3 text-xs select-all break-all flex items-start justify-between gap-2">
                <span className="whitespace-pre-wrap">{result}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={() => {
                    void navigator.clipboard.writeText(result);
                    toast.success("คัดลอกข้อมูลแล้ว");
                  }}
                >
                  คัดลอก
                </Button>
              </div>
            </div>
            {/^\/api\/files\/[a-f\d-]{36}$/i.test(result) ? (
              <Button asChild>
                <a href={result}>ดาวน์โหลดไฟล์สินค้า</a>
              </Button>
            ) : null}
            <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>
              ปิดหน้าต่าง
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={product.image}
                alt=""
                className="size-16 shrink-0 rounded-xl border border-border/40 bg-white object-contain p-1"
              />
              <div>
                <p className="font-semibold text-base">{product.name}</p>
                <p className="text-xs text-muted line-clamp-1">{product.subtitle}</p>
                <p className="mt-1 tabular text-lg font-bold text-fg">
                  {formatBaht(product.price)}
                </p>
              </div>
            </div>

            {product.description ? (
              <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-4 text-sm text-muted">
                {product.description}
              </p>
            ) : null}
            {product.warrantyDays ? (
              <p className="text-xs text-muted">
                รับประกัน {product.warrantyDays} วัน ตามเงื่อนไขสินค้า
              </p>
            ) : null}
            <p className="text-xs text-muted">
              {product.stockMode === "individual"
                ? "เมื่อชำระสำเร็จ ระบบจะส่งสินค้าจากสต็อกให้ทันที และเปิดดูซ้ำได้ในประวัติการซื้อ"
                : "สินค้านี้รอแอดมินจัดส่งหลังชำระเงิน ตรวจสอบสถานะได้ในประวัติการซื้อ"}
            </p>

            <div className="space-y-1">
              <Label htmlFor="coupon">โค้ดส่วนลด (ถ้ามี)</Label>
              <Input
                id="coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                maxLength={40}
              />
              <p className="text-xs text-muted">
                ส่วนลดจะตรวจและคำนวณจากเซิร์ฟเวอร์เมื่อยืนยันซื้อ
              </p>
            </div>

            {/* Financial summary breakdown */}
            {loggedIn ? (
              <div className="rounded-2xl border border-border/60 bg-surface-2/40 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="size-3.5 text-emerald-600" /> เครดิตในกระเป๋าของคุณ
                  </span>
                  <span className="tabular font-medium text-fg">{formatBaht(balance)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>ราคาสินค้า</span>
                  <span className="tabular font-medium text-fg">-{formatBaht(product.price)}</span>
                </div>
                <div className="border-t border-border/40 pt-1.5 flex items-center justify-between font-semibold">
                  <span>{coupon.trim() ? "คงเหลือก่อนคำนวณส่วนลด" : "คงเหลือหลังสั่งซื้อ"}</span>
                  <span className={cn("tabular", canAfford ? "text-emerald-600" : "text-rose-600")}>
                    {formatBaht(remaining)}
                  </span>
                </div>
                {!canAfford ? (
                  <p className="text-[11px] text-rose-500 pt-1">
                    * เครดิตไม่เพียงพอ กรุณาเติมเงินก่อนทำรายการสั่งซื้อ
                  </p>
                ) : null}
              </div>
            ) : null}

            {product.delivery === "topup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="uid">UID / เซิร์ฟเวอร์ผู้รับ</Label>
                <Input
                  id="uid"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="เช่น 123456789"
                />
              </div>
            ) : null}

            {loggedIn ? (
              <Button
                className="w-full rounded-full gap-2 font-medium"
                onClick={() => void purchase()}
                disabled={product.stock <= 0 || busy || !canAfford}
              >
                {busy
                  ? "กำลังตัดสต๊อก…"
                  : canAfford
                    ? "ยืนยันการสั่งซื้อ"
                    : "เครดิตไม่เพียงพอ (ไปเติมเงิน)"}
              </Button>
            ) : (
              <LoginDialog>
                <Button className="w-full rounded-full">เข้าสู่ระบบเพื่อสั่งซื้อ</Button>
              </LoginDialog>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

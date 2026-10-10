import { getMyDelivery } from "@/lib/shop/inventory";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Flame, Pencil, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { LoginDialog } from "@/components/login-dialog";
import { CategoryEditor } from "@/components/shop/category-editor";
import { ProductEditor } from "@/components/shop/product-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
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

export function ProductGrid({ initialCat = "all" }: { initialCat?: string }) {
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
    setLoading(true);
    const [p, c] = await Promise.all([listProducts(), listCategories()]);
    setItems(p);
    setCats(c);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  const list = useMemo(() => {
    const visible = cats.filter((c) => {
      if (c.id === "stream" && !flags.streaming) return false;
      if (c.id === "otp" && !flags.otp) return false;
      if (c.id === "smm" && !flags.smm) return false;
      return true;
    });
    const q = search.trim().toLowerCase();
    return {
      visible,
      items: items.filter((p) => {
        const categoryIsVisible = visible.some((c) => c.id === p.category);
        const inCategory = categoryIsVisible && (cat === "all" || p.category === cat);
        if (!inCategory) return false;
        if (!q) return true;
        const haystack = `${p.name} ${p.subtitle} ${p.category}`.toLowerCase();
        return haystack.includes(q);
      }),
    };
  }, [cat, flags, items, cats, search]);

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-subtle">
            ค้นหาสินค้า
          </label>
          <div className="mt-1 rounded-full border border-border bg-surface px-3 shadow-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / หมวด / รายละเอียด"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="text-xs text-muted">{list.items.length} รายการ</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-full flex-1 overflow-x-auto pb-2">
          <div className="flex w-max gap-2 sm:w-full sm:flex-wrap">
            <CatChip active={cat === "all"} onClick={() => setCat("all")}>
              ทั้งหมด
            </CatChip>
            {list.visible.map((c) => (
              <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.label}
              </CatChip>
            ))}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() => setEditingCats(true)}
            >
              แก้หมวด
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => setCreating(true)}>
              เพิ่มสินค้า
            </Button>
          </div>
        ) : null}
      </div>
      {loading ? (
        <p className="mt-8 text-sm text-muted">กำลังโหลดสินค้า…</p>
      ) : list.items.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-surface px-6 py-12 text-center shadow-border">
          <p className="font-medium">
            {items.length === 0 ? "ยังไม่มีสินค้าในร้าน" : "ยังไม่มีสินค้าในหมวดนี้"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {items.length === 0
              ? "แอดมินสามารถเพิ่มสินค้าที่ถูกต้องตามนโยบายร้านได้จากปุ่มด้านบน"
              : "ลองเลือกหมวดอื่น หรือเพิ่มสินค้าใหม่ในหมวดนี้"}
          </p>
          {isAdmin ? (
            <Button className="mt-5 rounded-full" onClick={() => setCreating(true)}>
              เพิ่มสินค้า
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((p) => (
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
  const { user } = useCurrentUserState();

  return (
    <>
      <article className="relative flex flex-col overflow-hidden rounded-3xl bg-surface shadow-border">
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
        <div className="relative overflow-hidden">
          <img
            src={product.image}
            alt=""
            className="h-44 w-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
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
        <div className="flex flex-1 flex-col p-4">
          <h3 className="pr-8 font-semibold tracking-tight">{product.name}</h3>
          <p className="mt-1 text-sm text-muted line-clamp-1">{product.subtitle}</p>
          <div className="mt-4 flex items-end justify-between border-t border-border/40 pt-3">
            <div>
              <p className="tabular text-xl font-bold tracking-tight text-fg">
                {formatBaht(product.price)}
              </p>
              {product.compareAt ? (
                <p className="tabular text-xs text-subtle line-through">
                  {formatBaht(product.compareAt)}
                </p>
              ) : null}
            </div>
            <div>
              {product.stock > 5 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> มีของ (
                  {product.stock})
                </span>
              ) : product.stock > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <span className="size-1.5 rounded-full bg-amber-500" /> เหลือ {product.stock}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
                  <span className="size-1.5 rounded-full bg-rose-400" /> สินค้าหมด
                </span>
              )}
            </div>
          </div>
          <Button
            className={cn(
              "mt-4 w-full rounded-full gap-2 font-medium transition-all",
              product.stock > 0 ? "hover:opacity-90" : "",
            )}
            onClick={() => setOpen(true)}
            disabled={product.stock <= 0}
          >
            <ShoppingBag className="size-4" />
            {product.stock <= 0 ? "สินค้าหมดชั่วคราว" : "สั่งซื้อทันที"}
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
  const [delivered, setDelivered] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRequestKey(null);
      setResult(null);
      setDelivered(false);
      setUid("");
    }
  }, [open, product.id]);

  async function purchase() {
    if (balance < product.price) {
      toast.error("ยอดเงินไม่พอ เติมเงินก่อนได้ที่เมนูเติมเงิน");
      return;
    }
    setBusy(true);
    const key = requestKey ?? crypto.randomUUID();
    setRequestKey(key);
    try {
      const res = await checkoutProduct({ data: { id: product.id, idempotencyKey: key } });
      if (!res.ok) {
        toast.error(res.message);
        setRequestKey(null);
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
  const canAfford = remaining >= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent title={product.name}>
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
              <div className="rounded-xl border border-border/60 bg-surface-2 p-3 font-mono text-xs select-all break-all flex items-start justify-between gap-2">
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
                className="size-16 rounded-xl object-cover shrink-0 border border-border/40"
              />
              <div>
                <p className="font-semibold text-base">{product.name}</p>
                <p className="text-xs text-muted line-clamp-1">{product.subtitle}</p>
                <p className="mt-1 tabular text-lg font-bold text-fg">
                  {formatBaht(product.price)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted">
              {product.stockMode === "individual"
                ? "เมื่อชำระสำเร็จ ระบบจะส่งสินค้าจากสต็อกให้ทันที และเปิดดูซ้ำได้ในประวัติการซื้อ"
                : "สินค้านี้รอแอดมินจัดส่งหลังชำระเงิน ตรวจสอบสถานะได้ในประวัติการซื้อ"}
            </p>

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
                  <span>คงเหลือหลังสั่งซื้อ</span>
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

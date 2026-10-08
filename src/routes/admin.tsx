import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Flame,
  Gift,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { ProductEditor } from "@/components/shop/product-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { getPaymentSlipEvidence, getShopSettings, listAllProducts, listPayments, saveShopSettings, type PaymentRow, type ShopSettings } from "@/lib/shop/actions";
import { getAdminStatus } from "@/lib/shop/admin-gate";
import { RedirectToSignIn, SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { categories, products, type Product } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";
import { cn, formatBaht, formatTime, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const [tab, setTab] = useState<"dash" | "products" | "pay" | "members" | "orders" | "claims" | "settings">("products");
  const { user, isPending } = useCurrentUserState();
  const [adminOk, setAdminOk] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.dataset.shop = "";
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user || user.isDevFallback) {
      setAdminOk(false);
      return;
    }
    void getAdminStatus()
      .then((s) => setAdminOk(Boolean(s.isAdmin)))
      .catch(() => setAdminOk(false));
  }, [user, isPending]);

  if (isPending || adminOk === null) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">กำลังตรวจสอบสิทธิ์แอดมิน…</div>;
  }
  if (!user || user.isDevFallback) return <RedirectToSignIn />;
  if (!adminOk) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
        <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
          <p className="font-medium">ไม่มีสิทธิ์แอดมิน</p>
          <p className="mt-2 text-sm text-muted">
            เข้าสู่ระบบด้วยอีเมลที่อยู่ใน ADMIN_EMAILS แล้วค่อยเปิด /admin
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/shop">กลับหน้าร้าน</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-shop className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <BrandMark to="/" />
          <span className="text-sm text-muted">แอดมิน</span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/shop">หน้าร้าน</Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4">
          {(
            [
              ["dash", "ภาพรวม"],
              ["products", "สินค้า"],
              ["pay", "ชำระเงิน"],
              ["members", "สมาชิก"],
              ["orders", "ประวัติ"],
              ["claims", "เคลม"],
              ["settings", "ตั้งค่า"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-10 shrink-0 rounded-md px-4 text-sm ${tab === id ? "bg-accent text-accent-fg" : "bg-surface shadow-border"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "dash" ? <Dash /> : null}
        {tab === "products" ? <ProductsAdmin /> : null}
        {tab === "pay" ? <PaymentsAdmin /> : null}
        {tab === "members" ? <Members /> : null}
        {tab === "orders" ? <Orders /> : null}
        {tab === "claims" ? <ClaimsAdmin /> : null}
        {tab === "settings" ? <Settings /> : null}
      </div>
    </div>
  );
}

function Dash() {
  const orders = useShop((s) => s.orders);
  const logs = useShop((s) => s.logs);
  const sales = orders.filter((o) => o.kind === "product");
  const today = sales.reduce((s, o) => s + o.price, 0);
  const topup = orders.filter((o) => o.kind === "topup").reduce((s, o) => s + o.price, 0);
  const chart = useMemo(() => {
    const hours = Array.from({ length: 7 }, (_, i) => ({
      name: ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"][i],
      sale: Math.round(800 + Math.sin(i) * 400 + i * 90),
    }));
    hours[hours.length - 1].sale = today + 420;
    return hours;
  }, [today]);

  const best = products.slice(0, 4).map((p, i) => ({
    name: p.name,
    n: 18 - i * 3 + sales.filter((o) => o.productId === p.id).length,
  }));

  const maxBest = Math.max(...best.map((b) => b.n), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="ยอดขายเดโม"
          value={formatBaht(today + 12840)}
          hint="รวมตัวอย่าง + ออเดอร์จริงในเครื่องนี้"
          icon={TrendingUp}
          badge="+14.2%"
          badgeTone="ok"
          iconBg="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
        />
        <Kpi
          label="เติมเงินเข้า"
          value={formatBaht(topup)}
          hint="PromptPay / Wallet / สลิป"
          icon={ArrowDownLeft}
          badge="ออโต้ 24 ชม."
          badgeTone="info"
          iconBg="bg-sky-500/10 text-sky-600 border border-sky-500/20"
        />
        <Kpi
          label="ออเดอร์"
          value={`${sales.length} รายการ`}
          hint="สินค้าดิจิทัลที่ตัดสต๊อกแล้ว"
          icon={PackageCheck}
          badge="ส่งทันที"
          badgeTone="purple"
          iconBg="bg-purple-500/10 text-purple-600 border border-purple-500/20"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-surface p-5 shadow-border">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">ยอดขายรายวัน</p>
              <p className="text-xs text-subtle">สรุปย้อนหลัง 7 วันล่าสุด</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              สดใหม่
            </span>
          </div>
          <ResponsiveContainer width="100%" height="82%">
            <BarChart data={chart}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18181b" />
                  <stop offset="100%" stopColor="#52525b" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--fg) 4%, transparent)" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  color: "var(--fg)",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="sale" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-border">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">สินค้าขายดี</p>
              <p className="text-xs text-subtle">จำแนกตามจำนวนชิ้นที่จำหน่าย</p>
            </div>
            <Badge tone="amber" className="gap-1">
              <Crown className="size-3" /> ยอดนิยม
            </Badge>
          </div>
          <ul className="space-y-3.5">
            {best.map((b, idx) => {
              const rankColor =
                idx === 0
                  ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                  : idx === 1
                    ? "bg-slate-200 text-slate-700 border border-slate-300"
                    : idx === 2
                      ? "bg-amber-700/15 text-amber-800 border border-amber-700/30"
                      : "bg-surface-2 text-muted border border-border/50";
              const pct = Math.round((b.n / maxBest) * 100);
              return (
                <li key={b.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", rankColor)}>
                        {idx + 1}
                      </span>
                      <span className="truncate font-medium">{b.name}</span>
                    </div>
                    <span className="shrink-0 tabular text-xs font-semibold text-muted">{b.n} ชิ้น</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        idx === 0 ? "bg-amber-500" : "bg-neutral-800",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="rounded-2xl bg-surface p-5 shadow-border">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">ล็อกการกระทำล่าสุด</p>
          <Badge tone="muted" className="text-[11px]">กิจกรรมแบบเรียลไทม์</Badge>
        </div>
        <ul className="max-h-72 space-y-2 overflow-auto font-mono text-xs">
          {logs.slice(0, 20).map((l) => {
            const actorTone =
              l.actor === "admin" ? "amber" : l.actor === "user" ? "info" : "ok";
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2/40 px-2.5 py-1.5 text-muted transition-colors hover:bg-surface-2/70">
                <span className="text-subtle text-[11px]">{relativeTime(l.at)}</span>
                <Badge tone={actorTone} className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                  {l.actor}
                </Badge>
                <span className="font-semibold text-fg">{l.action}</span>
                <span className="text-muted/80">{l.detail}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  badge,
  badgeTone = "ok",
  iconBg = "bg-accent/5 text-fg",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "ok" | "info" | "warn" | "danger" | "purple" | "emerald" | "amber";
  iconBg?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface p-4 shadow-border transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <div className={cn("grid size-8 place-items-center rounded-xl", iconBg)}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 tabular text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2">
        <p className="text-[11px] text-subtle">{hint}</p>
        {badge ? (
          <Badge tone={badgeTone} className="text-[10px] py-0 px-2">
            {badge}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function Members() {
  const name = useShop((s) => s.displayName || "ยังไม่เข้าสู่ระบบ");
  const balance = useShop((s) => s.balance);
  const loggedIn = useShop((s) => s.loggedIn);
  const adjust = useShop((s) => s.adjustBalance);
  const [delta, setDelta] = useState(50);
  const [reason, setReason] = useState("ชดเชยเคสเคลม");

  const quickAmounts = [50, 100, 200, 500, -50, -100];
  const quickReasons = [
    "ชดเชยเคสเคลม",
    "โบนัสกิจกรรม",
    "ทดลองเติมเครดิต",
    "แก้ไขข้อผิดพลาด",
  ];

  return (
    <div className="space-y-4">
      {/* User profile card */}
      <div className="rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 font-bold text-white shadow-sm ring-1 ring-black/5">
              {name.charAt(0).toUpperCase()}
              {loggedIn ? (
                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface bg-emerald-500 ring-2 ring-emerald-500/20" />
              ) : null}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base tracking-tight">{name}</p>
                {loggedIn ? (
                  <Badge tone="emerald" className="gap-1 text-[11px] py-0">
                    <ShieldCheck className="size-3" /> ยืนยันแล้ว
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={loggedIn ? "ok" : "muted"} className="text-[10px] py-0">
                  {loggedIn ? "สมาชิกออนไลน์" : "ยังไม่มีเซสชัน"}
                </Badge>
                <Badge tone="amber" className="gap-1 text-[10px] py-0">
                  <Crown className="size-2.5" /> VIP Member
                </Badge>
              </div>
            </div>
          </div>

          {/* Wallet balance display box */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Wallet className="size-3.5 text-emerald-600" /> ยอดคงเหลือ
              </span>
              <Badge tone="emerald" className="text-[10px] py-0 px-2">
                เครดิตพร้อมใช้
              </Badge>
            </div>
            <p className="mt-1.5 tabular text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {formatBaht(balance)}
            </p>
          </div>
        </div>

        {/* Quick presets for amounts */}
        <div className="mt-5 border-t border-border/50 pt-4">
          <p className="text-xs font-medium text-muted">เลือกยอดปรับด่วน:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setDelta(amt)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  delta === amt
                    ? "bg-accent text-accent-fg shadow-xs"
                    : amt > 0
                      ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/20",
                )}
              >
                {amt > 0 ? `+฿${amt}` : `-฿${Math.abs(amt)}`}
              </button>
            ))}
          </div>
        </div>

        {/* Quick reasons */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">เหตุผลยอดนิยม:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors border",
                  reason === r
                    ? "bg-surface-2 text-fg border-accent/40 font-medium"
                    : "bg-surface text-muted border-border/60 hover:text-fg hover:border-border",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Adjust Form */}
        <form
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            adjust(delta, reason);
            toast.success(
              delta >= 0
                ? `เพิ่มเครดิต ฿${delta} เรียบร้อยแล้ว`
                : `หักเครดิต ฿${Math.abs(delta)} เรียบร้อยแล้ว`,
            );
          }}
        >
          <div>
            <Label className="text-xs text-subtle mb-1 block">จำนวนเครดิต (บาท)</Label>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              className={cn(
                "font-semibold tabular",
                delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "",
              )}
            />
          </div>
          <div>
            <Label className="text-xs text-subtle mb-1 block">เหตุผล / หมายเหตุบันทึกล็อก</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className={cn(
                "w-full sm:w-auto font-medium gap-1.5",
                delta < 0
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-accent hover:opacity-90 text-accent-fg",
              )}
            >
              {delta >= 0 ? (
                <>
                  <Plus className="size-4" /> เพิ่มยอด (+{formatBaht(delta)})
                </>
              ) : (
                <>หักยอด (-{formatBaht(Math.abs(delta))})</>
              )}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-subtle flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-muted/40" />
          ใส่เลขติดลบเพื่อหักเครดิต · ทุกครั้งจะถูกบันทึกในล็อกแอดมินโดยอัตโนมัติ
        </p>
      </div>

      {/* Member summary footer */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface p-3.5 shadow-border flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-xs text-subtle">สิทธิ์การใช้งาน</p>
            <p className="text-sm font-medium">เข้าถึงหน้าร้านเต็มรูปแบบ</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface p-3.5 shadow-border flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
            <CreditCard className="size-4" />
          </div>
          <div>
            <p className="text-xs text-subtle">ช่องทางชำระ</p>
            <p className="text-sm font-medium">PromptPay / สลิป / วอลเล็ท</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface p-3.5 shadow-border flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-purple-500/10 text-purple-600">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-xs text-subtle">สิทธิพิเศษ</p>
            <p className="text-sm font-medium">กิจกรรมสุ่มรางวัล & แฟลชเซล</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Orders() {
  const orders = useShop((s) => s.orders);
  const [kind, setKind] = useState<"all" | "product" | "topup" | "wheel" | "box" | "gift">("all");
  const list = orders.filter((o) => kind === "all" || o.kind === kind);

  const kindMeta = {
    all: { label: "ทั้งหมด", icon: PackageCheck, tone: "muted" as const },
    product: { label: "สินค้าดิจิทัล", icon: ShoppingBag, tone: "info" as const },
    topup: { label: "เติมเงิน", icon: ArrowDownLeft, tone: "ok" as const },
    wheel: { label: "วงล้อสุ่ม", icon: Sparkles, tone: "warn" as const },
    box: { label: "กล่องสุ่ม", icon: Package, tone: "purple" as const },
    gift: { label: "ของขวัญ", icon: Gift, tone: "danger" as const },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "product", "topup", "wheel", "box", "gift"] as const).map((k) => {
          const meta = kindMeta[k];
          const Icon = meta.icon;
          const count = orders.filter((o) => k === "all" || o.kind === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
                kind === k
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "bg-surface text-muted shadow-border hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              <span>{meta.label}</span>
              <span className="ml-1 rounded-full bg-surface-2/80 px-1.5 py-0.2 text-[10px] tabular">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="divide-y divide-border rounded-2xl bg-surface shadow-border overflow-hidden">
        {list.length === 0 ? (
          <li className="p-8 text-center text-sm text-muted">ไม่มีรายการในหมวดนี้</li>
        ) : null}
        {list.map((o) => {
          const isTopup = o.kind === "topup";
          const meta = kindMeta[o.kind as keyof typeof kindMeta] || kindMeta.product;
          return (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 p-4 transition-colors hover:bg-surface-2/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone={meta.tone} className="text-[11px] py-0.5">
                    {meta.label}
                  </Badge>
                  <p className="font-semibold text-sm">{o.name}</p>
                </div>
                <p className="text-xs text-subtle flex items-center gap-1">
                  <Clock className="size-3" /> {formatTime(o.at)}
                </p>
                {o.payload ? (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2/60 px-2.5 py-1.5 font-mono text-xs text-muted max-w-lg border border-border/40">
                    <span className="truncate select-all">{o.payload}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(o.payload ?? "");
                        toast.success("คัดลอกข้อมูลแล้ว");
                      }}
                      className="ml-auto text-subtle hover:text-fg"
                      title="คัดลอก"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "tabular text-sm font-semibold",
                    isTopup ? "text-emerald-600" : "text-fg",
                  )}
                >
                  {isTopup ? `+${formatBaht(o.price)}` : o.price ? formatBaht(o.price) : "ฟรี"}
                </p>
                <Badge tone={isTopup ? "emerald" : "muted"} className="mt-1 text-[10px] py-0">
                  {isTopup ? "เติมเงินสำเร็จ" : "จัดส่งแล้ว"}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClaimsAdmin() {
  const claims = useShop((s) => s.claims);
  const reply = useShop((s) => s.replyClaim);
  const [text, setText] = useState<Record<string, string>>({});
  return (
    <ul className="space-y-3">
      {claims.length === 0 ? <p className="text-sm text-muted">ยังไม่มีเคลม</p> : null}
      {claims.map((c) => (
        <li key={c.id} className="rounded-xl bg-surface p-4 shadow-border">
          <div className="flex items-center justify-between">
            <p className="font-medium">{c.title}</p>
            <Badge tone={c.status === "replied" ? "ok" : "warn"}>{c.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{c.message}</p>
          {c.status === "open" ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                reply(c.id, text[c.id] || "ดำเนินการเปลี่ยนไอดีให้แล้ว");
                toast.success("ตอบเคลมแล้ว");
              }}
            >
              <Input
                value={text[c.id] ?? ""}
                onChange={(e) => setText((s) => ({ ...s, [c.id]: e.target.value }))}
                placeholder="ข้อความตอบกลับ"
              />
              <Button type="submit">ตอบ</Button>
            </form>
          ) : (
            <p className="mt-2 text-sm">ตอบแล้ว: {c.reply}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Settings() {
  const provider = useShop((s) => s.slipProvider);
  const setProvider = useShop((s) => s.setSlipProvider);
  const fee = useShop((s) => s.walletFee);
  const setFee = useShop((s) => s.setWalletFee);
  const banner = useShop((s) => s.banner);
  const setBanner = useShop((s) => s.setBanner);
  const flags = useShop((s) => s.navFlags);
  const setNavFlag = useShop((s) => s.setNavFlag);
  const [feeInput, setFeeInput] = useState(String(fee));
  const [bannerInput, setBannerInput] = useState(banner);
  const [updated, setUpdated] = useState<string[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [shopBusy, setShopBusy] = useState(false);

  useEffect(() => {
    void getShopSettings().then(setShop);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border lg:col-span-2">
        <h2 className="font-medium">บัญชีรับเงิน (พร้อมเพย์ / True Wallet)</h2>
        <p className="text-sm text-muted">ค่าเหล่านี้ใช้สร้าง QR และตรวจสลิป · แก้ได้เฉพาะแอดมิน</p>
        {shop ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="recv">พร้อมเพย์</Label>
              <Input
                id="recv"
                value={shop.receive_account}
                onChange={(e) => setShop({ ...shop, receive_account: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rname">ชื่อบัญชี</Label>
              <Input
                id="rname"
                value={shop.receive_name}
                onChange={(e) => setShop({ ...shop, receive_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wphone">เบอร์ True Wallet</Label>
              <Input
                id="wphone"
                value={shop.wallet_phone}
                onChange={(e) => setShop({ ...shop, wallet_phone: e.target.value })}
              />
            </div>
            <Button
              type="button"
              className="rounded-full sm:col-span-3"
              disabled={shopBusy}
              onClick={() => {
                setShopBusy(true);
                void saveShopSettings({
                  data: {
                    receive_account: shop.receive_account,
                    receive_name: shop.receive_name,
                    wallet_phone: shop.wallet_phone,
                    wallet_fee: shop.wallet_fee,
                    slip_provider: shop.slip_provider,
                  },
                })
                  .then((res) => {
                    if (res.ok) {
                      setShop(res.settings);
                      toast.success("บันทึกบัญชีรับเงินแล้ว");
                    }
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ"))
                  .finally(() => setShopBusy(false));
              }}
            >
              {shopBusy ? "กำลังบันทึก…" : "บันทึกบัญชีรับเงิน"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">กำลังโหลด…</p>
        )}
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border">
        <h2 className="font-medium">ผู้ให้บริการตรวจสลิป</h2>
        <p className="text-sm text-muted">สลับค่ายได้โดยไม่ต้องแตะโค้ด</p>
        <div className="flex gap-2">
          {(["thunder", "slip2go"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setProvider(p);
                void saveShopSettings({ data: { slip_provider: p } });
                toast.success(`ใช้ ${p}`);
              }}
              className={`min-h-11 rounded-md px-4 text-sm ${provider === p ? "bg-accent text-accent-fg" : "shadow-border"}`}
            >
              {p === "thunder" ? "Thunder API" : "Slip2Go"}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border">
        <h2 className="font-medium">ค่าธรรมเนียม True Wallet</h2>
        <Label htmlFor="fee">เปอร์เซ็นต์</Label>
        <div className="flex gap-2">
          <Input id="fee" type="number" step="0.1" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} />
          <Button
            type="button"
            onClick={() => {
              setFee(Number(feeInput));
              void saveShopSettings({ data: { wallet_fee: Number(feeInput) } });
              toast.success("บันทึกค่าธรรมเนียม");
            }}
          >
            บันทึก
          </Button>
        </div>
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border lg:col-span-2">
        <h2 className="font-medium">แบนเนอร์หน้าแรก</h2>
        <Textarea value={bannerInput} onChange={(e) => setBannerInput(e.target.value)} />
        <Button
          type="button"
          onClick={() => {
            setBanner(bannerInput);
            toast.success("อัปเดตแบนเนอร์");
          }}
        >
          บันทึกแบนเนอร์
        </Button>
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border">
        <h2 className="font-medium">เปิด-ปิดเมนู</h2>
        {(["streaming", "otp", "smm"] as const).map((k) => (
          <label key={k} className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm uppercase">{k}</span>
            <input
              type="checkbox"
              checked={flags[k]}
              onChange={(e) => setNavFlag(k, e.target.checked)}
              className="size-5 accent-current"
            />
          </label>
        ))}
      </section>
      <section className="space-y-3 rounded-xl bg-surface p-5 shadow-border">
        <h2 className="font-medium">อัปเดตจาก GitHub</h2>
        <p className="text-sm text-muted">จำลองการดึงเวอร์ชันล่าสุด โดยไม่ทับไฟล์สำคัญ</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const v = `V1.${updated.length + 4}.0`;
            setUpdated((s) => [`${v} · ${new Date().toLocaleString("th-TH")}`, ...s]);
            toast.success(`อัปเดต ${v} สำเร็จ`);
          }}
        >
          อัปเดตครั้งนี้
        </Button>
        <ul className="font-mono text-xs text-muted">
          {updated.map((u) => (
            <li key={u}>{u}</li>
          ))}
          <li>V1.3.2 · คง .env และ uploads</li>
        </ul>
      </section>
    </div>
  );
}

function ProductsAdmin() {
  const [rows, setRows] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setRows(await listAllProducts());
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">ฐานข้อมูลสินค้า</h2>
          <p className="text-sm text-muted">แก้ไขแล้วติดหน้าร้านทันที · สต๊อกตัดตอนซื้อพร้อมกัน</p>
        </div>
        <Button className="rounded-full" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          เพิ่มสินค้า
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-3xl bg-surface shadow-border">
        {rows.length === 0 ? <li className="p-4 text-sm text-muted">กำลังโหลดหรือยังไม่มีสินค้า</li> : null}
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <img src={p.image} alt="" className="size-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted">
                {categories.find((c) => c.id === p.category)?.label ?? p.category} · คงเหลือ {p.stock} · {formatBaht(p.price)}
              </p>
            </div>
            {p.active === false ? <Badge tone="warn">ซ่อน</Badge> : null}
            {p.flash ? <Badge tone="warn">Flash</Badge> : null}
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setEditing(p)}>
              <Pencil className="size-3.5" />
              แก้ไข
            </Button>
          </li>
        ))}
      </ul>
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
    </div>
  );
}

function PaymentsAdmin() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

  async function reload() {
    setRows(await listPayments());
  }

  async function toggleEvidence(id: string) {
    if (openEvidence === id) {
      setOpenEvidence(null);
      return;
    }
    try {
      let dataUrl = evidence[id];
      if (!dataUrl) {
        const result = await getPaymentSlipEvidence({ data: { id } });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        dataUrl = result.dataUrl;
        setEvidence((current) => ({ ...current, [id]: dataUrl }));
      }
      setOpenEvidence(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ไม่มีสิทธิ์ดูสลิปนี้");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">รายการชำระเงินและสลิปรอตรวจ</h2>
          <p className="text-sm text-muted">True Wallet อยู่ในคิวตรวจมือและยังไม่เติมเครดิต · PromptPay เติมเมื่อ verifier ยืนยันบัญชีและยอดตรงเท่านั้น</p>
        </div>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => void reload()}>
          รีเฟรช
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-3xl bg-surface shadow-border">
        {rows.length === 0 ? <li className="p-4 text-sm text-muted">ยังไม่มีรายการเติมเงิน</li> : null}
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {p.method} · {p.provider}
              </p>
              <p className="text-xs text-subtle">{p.created_at}</p>
              {p.reject_reason ? <p className="mt-1 text-xs text-danger">{p.reject_reason}</p> : null}
              {p.has_slip ? (
                <div className="mt-2">
                  <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => void toggleEvidence(p.id)}>
                    {openEvidence === p.id ? "ซ่อนสลิป" : "ดูสลิป"}
                  </Button>
                  {openEvidence === p.id && evidence[p.id] ? (
                    <img src={evidence[p.id]} alt={`หลักฐานสลิป ${p.id}`} className="mt-3 max-h-[70dvh] max-w-full rounded-xl border border-border object-contain" />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className="tabular text-sm">{formatBaht(Number(p.amount))}</p>
              <Badge tone={p.status === "success" ? "ok" : "warn"}>{p.status}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

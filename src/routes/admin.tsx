import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { DigitalInventoryEditor } from "@/components/shop/digital-inventory-editor";
import { ProductEditor } from "@/components/shop/product-editor";
import { CategoryEditor } from "@/components/shop/category-editor";
import {
  AdminRecords,
  RealDashboard,
  RealSettings,
  MediaLibrary,
  SystemPanel,
  BackupPanel,
  CampaignSettings,
} from "@/components/shop/admin-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { z } from "zod";
import { DataImport } from "@/components/shop/data-import";
import { Plus, Pencil } from "lucide-react";
import { getAdminStatus } from "@/lib/shop/admin-gate";
import {
  listAllProducts,
  getShopSettings,
  saveShopSettings,
  type ShopSettings,
} from "@/lib/shop/actions";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { categories, type Product } from "@/lib/shop/catalog";
import { formatBaht } from "@/lib/utils";
import type { RecordKind } from "@/lib/shop/admin-data";
export const Route = createFileRoute("/admin")({
  validateSearch: (value) =>
    z
      .object({ tab: z.string().max(80).optional(), status: z.string().max(80).optional() })
      .parse(value),
  component: AdminPage,
});
const tabs = [
  ["dashboard", "ภาพรวม", "dashboard.read"],
  ["products", "สินค้า / หมวด", "products.manage"],
  ["stock", "สต็อก", "stock.manage"],
  ["orders", "ออเดอร์", "orders.manage"],
  ["payments", "เติมเงิน", "topups.manage"],
  ["users", "สมาชิก", "users.read"],
  ["claims", "เคลม", "claims.manage"],
  ["gifts", "ของขวัญ", "gift_codes.manage"],
  ["coupons", "ส่วนลด", "promotions.manage"],
  ["content", "ประกาศ / แบนเนอร์", "promotions.manage"],
  ["media", "รูปภาพ", "media.manage"],
  ["transactions", "ธุรกรรม", "wallet.manage"],
  ["audit", "ประวัติการแก้ไข", "audit.read"],
  ["sessions", "อุปกรณ์ที่เข้าสู่ระบบ", "users.read"],
  ["logins", "ประวัติเข้าสู่ระบบ", "users.read"],
  ["jobs", "งานเบื้องหลัง", "system.manage"],
  ["settings", "ตั้งค่าร้าน", "system.manage"],
  ["payment-settings", "ตั้งค่าการชำระ", "system.manage"],
  ["system", "สถานะระบบ", "system.manage"],
  ["backups", "สำรองข้อมูล", "system.manage"],
  ["campaigns", "กงล้อ / กล่อง", "promotions.manage"],
] as const;
function AdminPage() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getAdminStatus>> | null>(null),
    [tab, setTab] = useState(search.tab ?? "dashboard"),
    [error, setError] = useState(false);
  useEffect(() => {
    if (search.tab) setTab(search.tab);
  }, [search.tab]);
  useEffect(() => {
    if (!user || isPending) return;
    let active = true;
    void getAdminStatus()
      .then((v) => {
        if (active) setAccess(v);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [user, isPending]);
  if (!isPending && !user) return <RedirectToSignIn />;
  if (error || (access && !access.isAdmin))
    return (
      <div className="p-8">
        <p>ไม่มีสิทธิ์เข้าหลังบ้าน</p>
        <Link to="/shop">กลับหน้าร้าน</Link>
      </div>
    );
  if (!access) return <p className="p-8">กำลังตรวจสอบสิทธิ์…</p>;
  const allowed = tabs.filter(
    (t) => access.permissions.includes("*") || access.permissions.includes(t[2]),
  );
  const active = allowed.some((t) => t[0] === tab) ? tab : (allowed[0]?.[0] ?? "dashboard");
  return (
    <div data-shop className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <BrandMark to="/shop" />
          <p className="text-sm">หลังบ้าน Veltshop</p>
          <Button asChild variant="ghost">
            <Link to="/shop">หน้าร้าน</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <nav aria-label="เมนูแอดมิน" className="mb-6 flex gap-2 overflow-x-auto pb-3">
          {allowed.map(([id, label]) => (
            <Button
              key={id}
              variant={active === id ? "primary" : "secondary"}
              className="shrink-0"
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
        <h1 className="mb-5 text-xl font-semibold">{allowed.find((t) => t[0] === active)?.[1]}</h1>
        {active === "dashboard" ? (
          <RealDashboard />
        ) : active === "products" ? (
          <ProductsAdmin />
        ) : active === "settings" ? (
          <RealSettings />
        ) : active === "payment-settings" ? (
          <PaymentSettings />
        ) : active === "media" ? (
          <MediaLibrary />
        ) : active === "campaigns" ? (
          <CampaignSettings />
        ) : active === "backups" ? (
          <BackupPanel />
        ) : active === "system" ? (
          <SystemPanel />
        ) : (
          <AdminRecords
            key={active}
            kind={active as RecordKind}
            permissions={access.permissions}
            initialStatus={active === "payments" ? search.status : undefined}
          />
        )}
      </main>
    </div>
  );
}
function ProductsAdmin() {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);
  const [rows, setRows] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = rows.filter((p) =>
    `${p.id} ${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const displayed = filtered.slice(page * 20, (page + 1) * 20);

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
      <Button
        variant="secondary"
        onClick={() => {
          const keys = [
            "id",
            "name",
            "subtitle",
            "category",
            "price",
            "stock",
            "delivery",
            "active",
          ] as const;
          const cell = (v: unknown) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"';
          const csv = [
            keys.join(","),
            ...filtered.map((row) => keys.map((key) => cell(row[key])).join(",")),
          ].join("\r\n");
          const url = URL.createObjectURL(
            new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "products.csv";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        ส่งออกสินค้าที่ค้นหาเป็น CSV
      </Button>
      <DataImport kind="products" onSaved={() => void reload()} />
      <Input
        placeholder="ค้นหาสินค้า"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      <ul className="divide-y divide-border rounded-3xl bg-surface shadow-border">
        {rows.length === 0 ? (
          <li className="p-4 text-sm text-muted">กำลังโหลดหรือยังไม่มีสินค้า</li>
        ) : null}
        {displayed.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <img src={p.image} alt="" className="size-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted">
                {categories.find((c) => c.id === p.category)?.label ?? p.category} · คงเหลือ{" "}
                {p.stock} · {formatBaht(p.price)}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setInventoryProduct(p)}>
              สต็อกจริง
            </Button>
            {p.active === false ? <Badge tone="warn">ซ่อน</Badge> : null}
            {p.flash ? <Badge tone="warn">Flash</Badge> : null}
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() => setEditing(p)}
            >
              <Pencil className="size-3.5" />
              แก้ไข
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
          ก่อนหน้า
        </Button>
        <span className="text-sm">
          หน้า {page + 1} · {filtered.length} รายการ
        </span>
        <Button
          variant="secondary"
          disabled={(page + 1) * 20 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          ถัดไป
        </Button>
      </div>
      <Button variant="secondary" onClick={() => setCategoryOpen(true)}>
        จัดการหมวดหมู่
      </Button>
      <CategoryEditor
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        onSaved={() => void reload()}
      />
      <DigitalInventoryEditor
        product={inventoryProduct}
        onClose={() => setInventoryProduct(null)}
        onSaved={() => void reload()}
      />
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

function PaymentSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  useEffect(() => {
    void getShopSettings().then(setSettings);
  }, []);
  if (!settings) return <p>กำลังโหลด…</p>;
  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void saveShopSettings({ data: settings })
          .then((r) => {
            if (r.ok) toast.success("บันทึกแล้ว");
            else toast.error(r.message);
          })
          .catch(() => toast.error("บันทึกไม่สำเร็จ"));
      }}
    >
      {[
        ["receive_name", "ชื่อผู้รับ"],
        ["receive_account", "พร้อมเพย์"],
        ["wallet_phone", "หมายเลข TrueMoney"],
        ["wallet_fee", "ค่าธรรมเนียม TrueMoney (%)"],
      ].map(([key, label]) => (
        <div key={key}>
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            value={String(settings[key as keyof ShopSettings])}
            onChange={(e) =>
              setSettings({
                ...settings,
                [key]: key === "wallet_fee" ? Number(e.target.value) : e.target.value,
              })
            }
          />
        </div>
      ))}
      <p className="text-xs text-muted">เลขพร้อมเพย์ต้องตรงกับค่าปลายทางที่เซิร์ฟเวอร์ตรวจสอบ</p>
      <Button type="submit">ยืนยันบันทึก</Button>
    </form>
  );
}

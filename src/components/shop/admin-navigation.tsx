import { useState, type CSSProperties } from "react";
import {
  Bell,
  Box,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileClock,
  Gift,
  Images,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import { Input, Label, NativeSelect } from "@/components/ui/input";

type Entry = readonly [string, string, string];
const groups = [
  {
    label: "ภาพรวม",
    color: "var(--icon-blue)",
    icon: LayoutDashboard,
    ids: ["dashboard", "notifications"],
  },
  {
    label: "ขายและดูแลลูกค้า",
    color: "var(--icon-teal)",
    icon: CircleDollarSign,
    ids: ["cart-requests", "orders", "claims", "users"],
  },
  {
    label: "สินค้าและสต็อก",
    color: "var(--icon-purple)",
    icon: Package,
    ids: ["products", "stock", "media"],
  },
  {
    label: "โปรโมชัน",
    color: "var(--icon-orange)",
    icon: Megaphone,
    ids: ["coupons", "gifts", "content", "campaigns"],
  },
  {
    label: "บัญชีและความปลอดภัย",
    color: "var(--icon-blue)",
    icon: ShieldCheck,
    ids: ["sessions", "logins", "privacy", "audit"],
  },
  {
    label: "ดูแลระบบ",
    color: "var(--icon-teal)",
    icon: Wrench,
    ids: ["settings", "system", "jobs", "backups"],
  },
];
const icons: Record<string, typeof Package> = {
  dashboard: ChartNoAxesCombined,
  notifications: Bell,
  "cart-requests": ListOrdered,
  orders: CircleDollarSign,
  users: Users,
  stock: Box,
  products: Package,
  media: Images,
  coupons: Ticket,
  gifts: Gift,
  content: Megaphone,
  settings: Settings2,
  audit: FileClock,
};

export function AdminNavigation({
  entries,
  active,
  onSelect,
}: {
  entries: readonly Entry[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <div className="mb-4 lg:hidden">
        <Label htmlFor="admin-navigation">เลือกงานที่ต้องการจัดการ</Label>
        <NativeSelect
          id="admin-navigation"
          value={active}
          className="mt-2"
          onChange={(e) => onSelect(e.target.value)}
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.ids
                .map((id) => entries.find((entry) => entry[0] === id))
                .filter((entry): entry is Entry => Boolean(entry))
                .map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>
      <nav
        aria-label="เมนูแอดมิน"
        className="hidden min-w-0 self-start rounded-3xl border border-border bg-surface p-3 lg:sticky lg:top-5 lg:block lg:max-h-[calc(100dvh-2.5rem)] lg:overflow-y-auto"
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3.5 size-4 text-muted" aria-hidden="true" />
          <Input
            aria-label="ค้นหาเมนูแอดมิน"
            placeholder="ค้นหาเมนู…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          {groups.map((group) => {
            const visible = group.ids
              .map((id) => entries.find((entry) => entry[0] === id))
              .filter(
                (entry): entry is Entry =>
                  Boolean(entry) && (!query || entry![1].includes(query.trim())),
              );
            if (!visible.length) return null;
            return (
              <section key={group.label} style={{ "--group-color": group.color } as CSSProperties}>
                <h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-fg">
                  <span className="admin-group-icon">
                    <group.icon className="size-4" aria-hidden="true" />
                  </span>
                  {group.label}
                </h2>
                {visible.map(([id, label]) => {
                  const Icon = icons[id] ?? group.icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="admin-nav-button"
                      aria-current={active === id ? "page" : undefined}
                      onClick={() => onSelect(id)}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
        {query && !entries.some(([, label]) => label.includes(query.trim())) ? (
          <p className="p-3 text-sm text-muted">ไม่พบเมนู</p>
        ) : null}
      </nav>
    </>
  );
}

import { useSiteConfiguration } from "@/lib/shop/site-state";
import { StoreContent } from "./store-content";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Clock3,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  MonitorPlay,
  ThumbsUp,
  UserRound,
  ScrollText,
  Settings2,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyWallet } from "@/lib/shop/actions";
import { getAdminStatus } from "@/lib/shop/admin-gate";
import { Button } from "@/components/ui/button";
import { categories, type CategoryId } from "@/lib/shop/catalog";
import { formatThaiClock, shopMeta } from "@/lib/shop/meta";
import { useShop } from "@/lib/shop/store";
import { BrandMark } from "@/components/brand-mark";
import { cn, formatBaht } from "@/lib/utils";

const catIcon: Record<CategoryId, typeof MonitorPlay> = {
  stream: MonitorPlay,
  game: Wallet,
  custom: Mail,
  otp: MessageSquare,
  smm: ThumbsUp,
  code: Wallet,
};

export function ShopShell() {
  const { value: site } = useSiteConfiguration();
  const loggedIn = useShop((s) => s.loggedIn);
  const name = useShop((s) => s.displayName);
  const balance = useShop((s) => s.balance);
  const login = useShop((s) => s.login);
  const logout = useShop((s) => s.logout);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    document.documentElement.dataset.shop = "";
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (user && !user.isDevFallback) {
      login(user.displayName || user.primaryEmail || "สมาชิก");
      let active = true;
      const refresh = () =>
        void getMyWallet()
          .then((wallet) => {
            if (active) useShop.setState({ balance: wallet.balance });
          })
          .catch(() => {
            if (active) useShop.setState({ balance: 0 });
          });
      refresh();
      const timer = setInterval(refresh, 15000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    } else if (!user || user.isDevFallback) {
      logout();
    }
  }, [user, isPending, login, logout]);

  async function handleLogout() {
    logout();
    try {
      await signOut("/shop");
    } catch {
      // Cookie clear failed — still leave local UI; user can retry.
      window.location.href = "/shop";
    }
  }

  return (
    <div data-shop className="min-h-dvh bg-bg text-fg">
      <ShopHeader
        loggedIn={loggedIn}
        name={name}
        balance={balance}
        onLogout={() => void handleLogout()}
      />
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pt-5 pb-36 sm:px-6">
        {site.maintenance ? (
          <section className="rounded-xl bg-surface p-8 text-center">
            <h1 className="text-xl font-semibold">กำลังปรับปรุงร้าน</h1>
            <p className="mt-2">กรุณาลองใหม่ภายหลัง ทีมงานยังดูแลผ่าน Discord และ Facebook</p>
          </section>
        ) : (
          <>
            <StoreContent />
            <Outlet />
          </>
        )}
      </main>
      <ShopFooter />
      <BottomDock />
    </div>
  );
}

function ShopHeader({
  loggedIn,
  name,
  balance,
  onLogout,
}: {
  loggedIn: boolean;
  name: string;
  balance: number;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:h-[4.5rem] sm:px-6">
        <nav className="hidden shrink-0 items-center gap-1 lg:flex">
          <NavPill to="/shop">
            <Home className="size-3.5" />
            หน้าแรก
          </NavPill>
          <ProductMenu />
          <ToolsMenu />
        </nav>
        <BrandMark to="/shop" className="shrink-0" />
        <div className="ml-auto flex items-center gap-2">
          <LiveClock />
          {loggedIn ? (
            <>
              <Link
                to="/shop/topup"
                className="inline-flex min-h-10 items-center rounded-full bg-accent px-3 text-sm font-medium text-accent-fg"
              >
                {formatBaht(balance)}
              </Link>
              <ProfileMenu name={name} onLogout={onLogout} />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden min-h-10 items-center rounded-full bg-surface px-4 text-sm shadow-border sm:inline-flex"
              >
                เข้าสู่ระบบ
              </Link>
              <Button asChild size="sm" className="rounded-full px-4">
                <Link to="/login">สมัครสมาชิก</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ProfileMenu({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, isPending } = useCurrentUserState();

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

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (el && el.closest?.("[data-profile-menu]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" data-profile-menu>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-3 text-sm shadow-border"
      >
        <UserRound className="size-4" />
        <span className="hidden max-w-24 truncate sm:inline">{name}</span>
        <ChevronDown
          className={cn("size-3.5 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-50 pt-2">
          <div role="menu" className="min-w-52 rounded-2xl bg-surface p-2 shadow-border">
            <p className="truncate px-3 py-1.5 text-xs text-muted">{name}</p>
            <Link
              to="/shop/profile"
              role="menuitem"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
              onClick={() => setOpen(false)}
            >
              <UserRound className="size-4 text-accent" />
              โปรไฟล์
            </Link>
            <Link
              to="/shop/history"
              role="menuitem"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
              onClick={() => setOpen(false)}
            >
              <ScrollText className="size-4 text-accent" />
              ประวัติ
            </Link>
            <Link
              to="/shop/settings"
              role="menuitem"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
              onClick={() => setOpen(false)}
            >
              <Settings2 className="size-4 text-accent" />
              ตั้งค่า
            </Link>
            {isAdmin ? (
              <Link
                to="/admin"
                role="menuitem"
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="size-4 text-accent" />
                แอดมิน / แก้ร้าน
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="size-4 text-muted" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavPill({ to, children }: { to: "/shop"; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-fg"
      activeOptions={{ exact: to === "/shop" }}
      activeProps={{ className: "bg-surface text-fg shadow-border" }}
    >
      {children}
    </Link>
  );
}

function ProductMenu() {
  const flags = useShop((s) => s.navFlags);
  const items = categories.filter((c) => {
    if (c.id === "stream" && !flags.streaming) return false;
    if (c.id === "otp" && !flags.otp) return false;
    if (c.id === "smm" && !flags.smm) return false;
    return true;
  });

  return (
    <HoverMenu
      label="สินค้า"
      icon={<MonitorPlay className="size-3.5" />}
      items={items.map((c) => {
        const Icon = catIcon[c.id];
        return {
          to: "/shop/catalog" as const,
          search: { cat: c.id },
          label: c.label,
          icon: <Icon className="size-4 text-accent" />,
        };
      })}
    />
  );
}

function ToolsMenu() {
  return (
    <HoverMenu
      label="เครื่องมือ"
      icon={<Wrench className="size-3.5" />}
      items={[
        {
          to: "/shop/claims" as const,
          label: "เคลมสินค้า",
          icon: <Bell className="size-4 text-accent" />,
        },
      ]}
    />
  );
}

function HoverMenu({
  label,
  icon,
  items,
}: {
  label: string;
  icon: ReactNode;
  items: {
    to: "/shop/catalog" | "/admin" | "/shop/claims" | "/shop/history" | "/shop/settings";
    label: string;
    icon: ReactNode;
    search?: { cat: string };
  }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={cn(
          "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors duration-150",
          open ? "bg-surface text-fg shadow-border" : "text-muted hover:bg-surface hover:text-fg",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-50 pt-2">
          <div className="min-w-56 rounded-2xl bg-surface p-2 shadow-border">
            {items.map((item) => (
              <Link
                key={item.to + item.label}
                to={item.to}
                search={item.search}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-soft"
                onClick={() => setOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const stamp = now ? formatThaiClock(now) : { time: "--:--:--", date: "—" };

  return (
    <div className="hidden h-11 min-w-44 shrink-0 items-center gap-2 rounded-2xl bg-accent px-3 text-accent-fg sm:flex">
      <span className="tabular min-w-20 text-sm font-semibold tracking-wide">{stamp.time}</span>
      <span className="grid size-7 place-items-center rounded-full bg-accent-fg/15">
        <Clock3 className="size-3.5" />
      </span>
      <span className="text-xs leading-tight">
        {stamp.date}
        <span className="block opacity-80">เวลาไทย</span>
      </span>
    </div>
  );
}

function ShopFooter() {
  const { value: site } = useSiteConfiguration();
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-36 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl bg-surface p-5 shadow-border">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2.5 rounded-sm bg-accent" />
            เกี่ยวกับเรา
          </p>
          <h2 className="mt-3 text-base font-semibold">
            {site.name} — {site.description}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-soft px-3 py-1 text-xs text-accent">ระบบปลอดภัย</span>
            <span className="rounded-full bg-soft px-3 py-1 text-xs text-accent">
              บริการรวดเร็ว
            </span>
          </div>
        </article>
        <article className="rounded-3xl bg-surface p-5 shadow-border">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4 text-accent" />
            ช่องติดต่อ
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              Discord:{" "}
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                className="text-fg underline-offset-2 hover:underline"
              >
                เข้าร่วมเซิร์ฟ
              </a>
            </li>
            <li>
              Facebook:{" "}
              <a
                href={site.facebook}
                target="_blank"
                rel="noreferrer"
                className="text-fg underline-offset-2 hover:underline"
              >
                {shopMeta.facebook}
              </a>
            </li>
          </ul>
        </article>
        <article className="rounded-3xl bg-surface p-5 shadow-border">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="size-4 text-accent" />
            เวลาให้บริการ
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>{shopMeta.hoursWeek}</li>
            <li>{shopMeta.hoursWeekend}</li>
            <li className="text-subtle">{shopMeta.note}</li>
          </ul>
        </article>
      </div>
      <p className="mt-6 text-center text-xs text-subtle">
        © {new Date().getFullYear()} {site.name}. สงวนลิขสิทธิ์.
      </p>
    </footer>
  );
}

function BottomDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/shop/topup", label: "เติมเงิน", icon: Wallet },
    { to: "/shop/catalog", label: "ซื้อแอพ", icon: MonitorPlay },
  ] as const;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex w-[min(92vw,36rem)] items-end justify-between rounded-[2rem] bg-surface px-4 pt-2 pb-2 shadow-border">
        {items.map((item) => {
          const on = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-16 flex-col items-center gap-0.5 py-1 text-xs",
                on ? "text-accent" : "text-muted",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          to="/shop"
          className="-mt-7 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-border"
          aria-label="หน้าแรก"
        >
          <Home className="size-6" />
        </Link>
        <Link
          to="/shop/history"
          className={cn(
            "flex min-w-16 flex-col items-center gap-0.5 py-1 text-xs",
            path.startsWith("/shop/history") ? "text-accent" : "text-muted",
          )}
        >
          <ScrollText className="size-5" />
          ประวัติ
        </Link>
        <Link
          to="/shop/profile"
          className={cn(
            "flex min-w-16 flex-col items-center gap-0.5 py-1 text-xs",
            path === "/shop/profile" ? "text-accent" : "text-muted",
          )}
        >
          <UserRound className="size-5" />
          บัญชี
        </Link>
      </div>
    </div>
  );
}

export function EmptyGate({ children }: { children: ReactNode }) {
  const loggedIn = useShop((s) => s.loggedIn);
  if (loggedIn) return <>{children}</>;
  return (
    <div className="rounded-3xl bg-surface px-6 py-12 text-center shadow-border">
      <p className="font-medium">เข้าสู่ระบบเพื่อใช้งานส่วนนี้</p>
      <p className="mt-2 text-sm text-muted">ดูเครดิตและประวัติรายการของคุณ</p>
      <Button asChild className="mt-5 rounded-full">
        <Link to="/login">เข้าสู่ระบบ</Link>
      </Button>
    </div>
  );
}

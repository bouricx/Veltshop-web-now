import { ProductGrid } from "@/components/shop/product-grid";
import { onShopChange } from "@/lib/shop/realtime-client";
import { ArrowUpRight, ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Mail,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  Package,
  Shield,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { LiveFeed } from "@/components/shop/live-feed";
import { useEffect, useState } from "react";
import { storefrontSummary } from "@/lib/shop/storefront";
import { useSiteConfiguration } from "@/lib/shop/site-state";
import { shopMeta } from "@/lib/shop/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop/")({ component: ShopHome });

const tiles: {
  label: string;
  hint: string;
  to: "/shop/topup" | "/shop/catalog" | "/shop/alerts";
  search?: { cat: string };
  tint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    label: "เติมเงิน",
    hint: "TOP UP",
    to: "/shop/topup",
    tint: "bg-cat-wallet/12 text-cat-wallet",
    icon: Wallet,
  },
  {
    label: "แอพพรีเมียม",
    hint: "PREMIUM",
    to: "/shop/catalog",
    search: { cat: "stream" },
    tint: "bg-cat-premium/12 text-cat-premium",
    icon: MonitorPlay,
  },
  {
    label: "ซื้อเมล/บัญชี",
    hint: "EMAIL",
    to: "/shop/catalog",
    search: { cat: "custom" },
    tint: "bg-cat-mail/12 text-cat-mail",
    icon: Mail,
  },
  {
    label: "ซื้อ OTP",
    hint: "SMS/OTP",
    to: "/shop/catalog",
    search: { cat: "otp" },
    tint: "bg-cat-otp/12 text-cat-otp",
    icon: MessageSquare,
  },
  {
    label: "ยืนยันครัวเรือน",
    hint: "HOUSEHOLD",
    to: "/shop/catalog",
    search: { cat: "otp" },
    tint: "bg-cat-house/12 text-cat-house",
    icon: Shield,
  },
  {
    label: "ติดต่อแอดมิน",
    hint: "CONTACT",
    to: "/shop/alerts",
    tint: "bg-cat-line/12 text-cat-line",
    icon: MessageCircle,
  },
];

function ShopHome() {
  const config = useSiteConfiguration((s) => s.value);
  return (
    <div className="space-y-8 page-enter">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface p-6 sm:p-10">
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-xs font-medium">
            <Sparkles className="size-3.5" /> DIGITAL GOODS, SIMPLY YOURS
          </p>
          <h1 className="text-3xl font-semibold leading-[1.35] tracking-tight sm:text-5xl">
            ดิจิทัลที่ใช่
            <br />
            <span className="text-muted">เลือกง่าย ในที่เดียว</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
            {config.name} · {config.description}
            <br />
            เลือกสินค้า เติมเครดิต และติดตามทุกคำสั่งซื้อได้จากบัญชีของคุณ
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/shop/catalog"
              search={{ cat: "all" }}
              className="inline-flex min-h-12 items-center gap-6 rounded-xl bg-accent px-5 text-sm font-medium text-accent-fg"
            >
              เลือกดูสินค้า <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/shop/history"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium"
            >
              ประวัติการซื้อ <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-8 hidden size-80 items-center justify-center rounded-full border border-border bg-bg lg:flex"
        >
          <div className="size-60 rounded-full border border-border bg-surface" />
          <span className="hero-orbit absolute grid size-28 -rotate-6 place-items-center rounded-[2rem] border border-border bg-white shadow-xl shadow-black/5">
            <ShoppingBag className="size-10 text-fg" strokeWidth={1.3} />
          </span>
          <span className="absolute left-4 top-5 grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <MonitorPlay className="size-6" />
          </span>
          <span className="absolute bottom-6 left-8 grid size-12 place-items-center rounded-2xl bg-blue-100 text-blue-600">
            <Wallet className="size-5" />
          </span>
        </div>
      </section>
      <section className="rounded-3xl bg-surface p-5 shadow-border sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">เมนูแนะนำ</p>
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Recommend menu</p>
          </div>
          <a
            href={config.discord || shopMeta.discordInvite}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-medium text-accent-fg"
          >
            <MessageCircle className="size-3.5" />
            Discord
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles
            .filter((tile) => tile.label !== "ติดต่อแอดมิน")
            .map((tile) => (
              <Link
                key={tile.label}
                to={tile.to}
                search={tile.search}
                className="quick-link flex flex-col items-center gap-3 rounded-2xl bg-bg px-3 py-5 text-center"
              >
                <span className={cn("grid size-12 place-items-center rounded-2xl", tile.tint)}>
                  <tile.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{tile.label}</span>
                  <span className="mt-0.5 block text-xs tracking-[0.12em] text-subtle uppercase">
                    {tile.hint}
                  </span>
                </span>
              </Link>
            ))}
          <a
            href={config.discord || shopMeta.discordInvite}
            target="_blank"
            rel="noreferrer"
            className="quick-link flex flex-col items-center gap-3 rounded-2xl bg-bg px-3 py-5 text-center"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-600">
              <MessageCircle className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">ติดต่อแอดมิน</span>
              <span className="mt-0.5 block text-xs tracking-wider text-subtle">DISCORD</span>
            </span>
          </a>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-subtle">CURATED FOR YOU</p>
            <h2 className="mt-1 text-xl font-semibold">สินค้าแนะนำ</h2>
          </div>
          <Link
            to="/shop/catalog"
            search={{ cat: "all" }}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
          >
            ดูทั้งหมด
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <ProductGrid featuredOnly />
      </section>
      <ShopStats />
      <LiveFeed />
    </div>
  );
}

function ShopStats() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof storefrontSummary>>["stats"] | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    const load = () =>
      void storefrontSummary()
        .then((value) => {
          if (active) setStats(value.stats);
        })
        .catch(() => {});
    load();
    const unsubscribe = onShopChange(load);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  const cards = [
    {
      label: "สมาชิกทั้งหมด",
      value: stats?.members,
      icon: Users,
      color: "text-cat-wallet bg-cat-wallet/12",
    },
    {
      label: "สต๊อกรวมระบบ",
      value: stats?.stock,
      icon: Package,
      color: "text-cat-stock bg-cat-stock/12",
    },
    {
      label: "รายการเติมเงินสำเร็จ",
      value: stats?.topups,
      icon: Wallet,
      color: "text-ok bg-ok/12",
    },
    {
      label: "สินค้าพร้อมส่ง",
      value: stats?.ready,
      icon: Store,
      color: "text-cat-ready bg-cat-ready/12",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="relative overflow-hidden rounded-3xl bg-surface px-4 py-4 shadow-border"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">{card.label}</p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
                {card.value?.toLocaleString("th-TH") ?? "—"}
              </p>
              <p className="mt-1 text-xs text-ok">อัปเดตจากรายการจริง</p>
            </div>
            <span className={cn("grid size-9 place-items-center rounded-xl", card.color)}>
              <card.icon className="size-4" />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

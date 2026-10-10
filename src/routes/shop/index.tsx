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
    <div className="space-y-5">
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
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              search={tile.search}
              className="flex flex-col items-center gap-3 rounded-3xl bg-bg px-3 py-5 text-center transition-transform duration-150 hover:-translate-y-0.5"
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
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <LiveFeed />
        <ShopStats />
      </div>
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
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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

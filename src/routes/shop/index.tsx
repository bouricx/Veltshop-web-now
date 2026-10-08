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
import { useShop } from "@/lib/shop/store";
import { shopMeta } from "@/lib/shop/meta";
import { cn, formatBaht } from "@/lib/utils";

export const Route = createFileRoute("/shop/")({ component: ShopHome });

const tiles: {
  label: string;
  hint: string;
  to: "/shop/topup" | "/shop/catalog" | "/shop/alerts";
  search?: { cat: string };
  tint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { label: "เติมเงิน", hint: "TOP UP", to: "/shop/topup", tint: "bg-cat-wallet/12 text-cat-wallet", icon: Wallet },
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
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-surface p-5 shadow-border sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">เมนูแนะนำ</p>
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Recommend menu</p>
          </div>
          <a
            href={shopMeta.discordInvite}
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
  const stock = useShop((s) => s.stock);
  const orders = useShop((s) => s.orders);
  const stockSum = Object.values(stock).reduce((a, b) => a + b, 0);
  const ready = Object.values(stock).filter((n) => n > 0).length;
  const topups = 92484 + orders.filter((o) => o.kind === "topup").length;

  const cards = [
    {
      label: "สมาชิกทั้งหมด",
      value: 24064,
      delta: "เติบโตต่อเนื่อง",
      color: "text-cat-wallet bg-cat-wallet/12",
      points: [12, 18, 14, 22, 28, 21, 34],
      icon: Users,
    },
    {
      label: "สต๊อกรวมระบบ",
      value: 120201 + stockSum,
      delta: "+247 วันนี้",
      color: "text-cat-stock bg-cat-stock/12",
      points: [8, 12, 20, 18, 26, 24, 30],
      icon: Package,
    },
    {
      label: "รายการเติมเงิน",
      value: topups,
      delta: "+189 วันนี้",
      color: "text-ok bg-ok/12",
      points: [20, 16, 18, 14, 12, 10, 8],
      icon: Wallet,
    },
    {
      label: "สินค้าพร้อมส่ง",
      value: 274 + ready,
      delta: "สต๊อกพร้อมส่ง",
      color: "text-cat-ready bg-cat-ready/12",
      points: [10, 14, 12, 16, 18, 17, 22],
      icon: Store,
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
                {card.value.toLocaleString("th-TH")}
              </p>
              <p className="mt-1 text-xs text-ok">{card.delta}</p>
            </div>
            <span className={cn("grid size-9 place-items-center rounded-xl", card.color)}>
              <card.icon className="size-4" />
            </span>
          </div>
          <Spark points={card.points} className={card.color.split(" ")[0]} />
        </article>
      ))}
    </div>
  );
}

function Spark({ points, className }: { points: number[]; className: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 26 - ((p - min) / (max - min || 1)) * 20;
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const fill = `0,32 ${line} 100,32`;

  return (
    <svg viewBox="0 0 100 32" className={cn("mt-2 h-10 w-full", className)} aria-hidden>
      <polyline points={fill} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

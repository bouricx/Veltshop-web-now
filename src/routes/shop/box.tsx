import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { boxTiers } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop/box")({ component: BoxPage });

function BoxPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">กิจกรรม</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">กล่องสุ่ม</h1>
      <p className="mt-2 text-sm text-muted">
        เปิดกล่องละ ฿35 หรือใช้กล่องที่ได้จากกงล้อ ของหายากมีโอกาส 5% ตามที่แอดมินตั้ง
      </p>
      <div className="mt-8">
        <EmptyGate>
          <BoxOpen />
        </EmptyGate>
      </div>
    </div>
  );
}

function BoxOpen() {
  const openBox = useShop((s) => s.openBox);
  const boxes = useShop((s) => s.boxes);
  const [opening, setOpening] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function go() {
    setOpening(true);
    setMessage(null);
    await new Promise((r) => setTimeout(r, 700));
    const res = openBox();
    setOpening(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setTier(res.tier);
    setMessage(res.message);
    toast.success(res.message);
  }

  return (
    <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
      <button
        type="button"
        onClick={go}
        disabled={opening}
        className={cn(
          "overflow-hidden rounded-xl shadow-border transition-transform duration-250",
          opening && "scale-95 opacity-80",
        )}
      >
        <img src="/images/cat-box.jpg" alt="กล่องสุ่ม" className="h-72 w-full object-cover" />
      </button>
      <div className="space-y-4">
        <p className="text-sm text-muted">กล่องฟรีในคลัง {boxes} ใบ</p>
        <Button className="w-full" onClick={go} disabled={opening}>
          {opening ? "กำลังเปิด…" : boxes > 0 ? "เปิดกล่องฟรี" : "เปิดกล่อง ฿35"}
        </Button>
        {message ? (
          <div className="rounded-lg bg-surface p-4 shadow-border">
            {tier ? <Badge tone={tier === "legend" ? "warn" : tier === "rare" ? "ok" : "muted"}>{tier}</Badge> : null}
            <p className="mt-2 font-medium">{message}</p>
          </div>
        ) : null}
        <ul className="space-y-2 text-sm text-muted">
          {boxTiers.map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>{t.label}</span>
              <span className="tabular">{t.chance}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

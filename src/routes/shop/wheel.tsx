import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Button } from "@/components/ui/button";
import { wheelPrizes } from "@/lib/shop/catalog";
import { useShop } from "@/lib/shop/store";

export const Route = createFileRoute("/shop/wheel")({ component: WheelPage });

function WheelPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">กิจกรรม</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">กงล้อนำโชค</h1>
      <p className="mt-2 text-sm text-muted">
        แอดมินตั้งน้ำหนักโอกาสได้ในระบบจริง เดโมนี้สุ่มตามน้ำหนักที่กำหนดไว้ หมุนฟรี 2 ครั้งต่อบัญชี
      </p>
      <div className="mt-8">
        <EmptyGate>
          <Wheel />
        </EmptyGate>
      </div>
    </div>
  );
}

function Wheel() {
  const spin = useShop((s) => s.spin);
  const left = useShop((s) => s.spinsLeft);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const slice = 360 / wheelPrizes.length;

  function go() {
    const res = spin();
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setSpinning(true);
    setResult(null);
    const target = 360 * 6 + (360 - res.prizeIndex * slice - slice / 2);
    setAngle((prev) => prev + target);
    window.setTimeout(() => {
      setSpinning(false);
      setResult(res.message);
      toast.success(res.message);
    }, 2800);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem] lg:items-center">
      <div className="relative mx-auto size-72 sm:size-80">
        <div
          className="wheel-disc size-full rounded-full shadow-border"
          style={{
            transform: `rotate(${angle}deg)`,
            background: conic(slice),
          }}
        >
          {wheelPrizes.map((p, i) => (
            <span
              key={p.id}
              className="absolute top-1/2 left-1/2 origin-left text-xs font-medium text-bg"
              style={{
                transform: `rotate(${i * slice + slice / 2}deg) translate(4.5rem) rotate(90deg)`,
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
        <div className="absolute top-1/2 left-1/2 z-10 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg shadow-border" />
        <div className="absolute -top-1 left-1/2 z-10 h-8 w-3 -translate-x-1/2 rounded-sm bg-accent" />
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted">เหลือสิทธิ์ {left} ครั้ง</p>
        <Button className="w-full" onClick={go} disabled={spinning || left <= 0}>
          {spinning ? "กำลังหมุน…" : "หมุนกงล้อ"}
        </Button>
        {result ? <p className="text-sm text-ok">{result}</p> : null}
        <ul className="space-y-1 text-sm text-muted">
          {wheelPrizes.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.label}</span>
              <span className="tabular">{p.weight}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function conic(slice: number) {
  const colors = [
    "var(--accent)",
    "var(--muted)",
    "var(--surface-2)",
    "var(--subtle)",
    "var(--accent)",
    "var(--muted)",
    "var(--surface-2)",
    "var(--subtle)",
  ];
  const stops = wheelPrizes.map((_, i) => {
    const c = colors[i % colors.length];
    return `${c} ${i * slice}deg ${(i + 1) * slice}deg`;
  });
  return `conic-gradient(${stops.join(",")})`;
}

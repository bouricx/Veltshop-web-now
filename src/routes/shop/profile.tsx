import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/lib/shop/store";
import { formatBaht, formatTime } from "@/lib/utils";

export const Route = createFileRoute("/shop/profile")({ component: ProfilePage });

function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">สมาชิก</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">โปรไฟล์และประวัติ</h1>
      <div className="mt-8">
        <EmptyGate>
          <ProfileBody />
        </EmptyGate>
      </div>
    </div>
  );
}

function ProfileBody() {
  const name = useShop((s) => s.displayName);
  const balance = useShop((s) => s.balance);
  const orders = useShop((s) => s.orders);
  const redeem = useShop((s) => s.redeem);
  const [code, setCode] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="ชื่อ" value={name} />
        <Stat label="ยอดคงเหลือ" value={formatBaht(balance)} />
        <Stat label="รายการ" value={`${orders.length}`} />
      </section>

      <form
        className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-border sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const res = redeem(code);
          if (res.ok) toast.success(res.message); else toast.error(res.message);
          if (res.ok) setCode("");
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="โค้ดของขวัญ (ยังไม่เปิดใช้งาน)"
        />
        <Button type="submit">ใช้โค้ด</Button>
      </form>
      <p className="text-xs text-subtle">ทดลอง: WELCOME · VELT50 · FLASH20</p>

      <section>
        <h2 className="mb-3 font-medium">ประวัติทุกประเภท</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-surface shadow-border">
            {orders.map((o) => (
              <li key={o.id} className="p-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setOpenId(openId === o.id ? null : o.id)}
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-subtle">{formatTime(o.at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm">{o.price ? formatBaht(o.price) : "—"}</p>
                    <Badge tone={o.status === "success" ? "ok" : "warn"}>{o.kind}</Badge>
                  </div>
                </button>
                {openId === o.id && o.payload ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs">{o.payload}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-border">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

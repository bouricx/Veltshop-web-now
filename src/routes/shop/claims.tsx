import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useShop } from "@/lib/shop/store";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/shop/claims")({ component: ClaimsPage });

function ClaimsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">หลังการขาย</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">แจ้งเคลมสินค้า</h1>
      <p className="mt-2 text-sm text-muted">
        เลือกออเดอร์ที่ต้องการให้แอดมินตรวจสอบ แล้วไปตอบกลับได้ที่หน้าแอดมินของเดโมนี้
      </p>
      <div className="mt-8">
        <EmptyGate>
          <ClaimsBody />
        </EmptyGate>
      </div>
    </div>
  );
}

function ClaimsBody() {
  const orders = useShop((s) => s.orders.filter((o) => o.kind === "product"));
  const claims = useShop((s) => s.claims);
  const fileClaim = useShop((s) => s.fileClaim);
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-xl bg-surface p-5 shadow-border"
        onSubmit={(e) => {
          e.preventDefault();
          if (!orderId) {
            toast.error("ยังไม่มีออเดอร์ให้เคลม");
            return;
          }
          fileClaim(orderId, title, message);
          toast.success("ส่งเคลมแล้ว");
          setTitle("");
          setMessage("");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="oid">ออเดอร์</Label>
          <select
            id="oid"
            className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-border"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            {orders.length === 0 ? <option value="">ยังไม่มีออเดอร์</option> : null}
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct">หัวข้อ</Label>
          <Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="ไอดีเข้าไม่ได้" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm">รายละเอียด</Label>
          <Textarea id="cm" value={message} onChange={(e) => setMessage(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">
          ส่งเคลม
        </Button>
      </form>
      <ul className="space-y-3">
        {claims.length === 0 ? <p className="text-sm text-muted">ยังไม่มีเคลม</p> : null}
        {claims.map((c) => (
          <li key={c.id} className="rounded-xl bg-surface p-4 shadow-border">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{c.title}</p>
              <Badge tone={c.status === "replied" ? "ok" : "warn"}>
                {c.status === "replied" ? "ตอบแล้ว" : "รอแอดมิน"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{c.message}</p>
            <p className="mt-1 text-xs text-subtle">{formatTime(c.at)}</p>
            {c.reply ? <p className="mt-3 rounded-md bg-bg p-3 text-sm">แอดมิน: {c.reply}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

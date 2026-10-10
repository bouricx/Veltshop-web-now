import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fileClaim, myAccountData } from "@/lib/shop/operations";
import { listMyOrders } from "@/lib/shop/actions";
import { Input, Label, Textarea, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/shop/claims")({ component: ClaimsPage });
function ClaimsPage() {
  const { user } = useCurrentUserState();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">แจ้งปัญหา / ขอคืนเครดิต</h1>
      <p className="mt-2 text-sm text-muted">เลือกออเดอร์ของคุณ ทีมงานจะตรวจสอบประกันและตอบกลับ</p>
      <EmptyGate>
        <ClaimsBody key={user?.id ?? "out"} />
      </EmptyGate>
    </div>
  );
}
function ClaimsBody() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listMyOrders>>>([]),
    [claims, setClaims] = useState<Awaited<ReturnType<typeof myAccountData>>["claims"]>([]),
    [orderId, setOrderId] = useState(""),
    [title, setTitle] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () => {
    void listMyOrders()
      .then(setOrders)
      .catch(() => setError("โหลดออเดอร์ไม่สำเร็จ"));
    void myAccountData()
      .then((d) => setClaims(d.claims))
      .catch(() => setError("โหลดเคลมไม่สำเร็จ"));
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <form
        className="space-y-3 rounded-xl bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void fileClaim({ data: { orderId, title, message } })
            .then((r) => {
              if (r.ok) {
                toast.success("ส่งปัญหาแล้ว");
                setTitle("");
                setMessage("");
                load();
              } else toast.error(r.message);
            })
            .catch(() => toast.error("ส่งไม่สำเร็จ"))
            .finally(() => setBusy(false));
        }}
      >
        <Label htmlFor="claim-order">ออเดอร์</Label>
        <NativeSelect
          id="claim-order"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
        >
          <option value="">เลือกออเดอร์</option>
          {orders
            .filter((o) => ["processing", "completed"].includes(o.status))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.id.slice(0, 8)}
              </option>
            ))}
        </NativeSelect>
        <Label htmlFor="claim-title">หัวข้อ</Label>
        <Input
          id="claim-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
        <Label htmlFor="claim-message">รายละเอียด / เหตุผลขอคืนเครดิต</Label>
        <Textarea
          id="claim-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={3}
          maxLength={2000}
        />
        <Button disabled={busy || !orderId} type="submit">
          {busy ? "กำลังส่ง…" : "ยืนยันส่งเรื่อง"}
        </Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      <div className="space-y-3">
        {claims.length === 0 ? <p className="text-sm text-muted">ยังไม่มีเคลม</p> : null}
        {claims.map((c) => (
          <article key={c.id} className="rounded-xl border border-border p-4">
            <p className="font-medium">
              {c.title} · {c.status}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.message}</p>
            {c.reply ? (
              <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">ทีมงาน: {c.reply}</p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

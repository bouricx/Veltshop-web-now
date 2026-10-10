import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyDelivery } from "@/lib/shop/inventory";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMyOrders, listMyPayments, type PaymentRow } from "@/lib/shop/actions";
import { formatBaht, formatTime } from "@/lib/utils";

export const Route = createFileRoute("/shop/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useCurrentUserState();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">บัญชี</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">ประวัติ</h1>
      <p className="mt-2 text-sm text-muted">เติมเงินและการซื้อของคุณ</p>
      <div className="mt-8">
        <EmptyGate>
          <HistoryBody key={user?.id ?? "signed-out"} />
        </EmptyGate>
      </div>
    </div>
  );
}

function HistoryBody() {
  const [deliveries, setDeliveries] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<
    {
      id: string;
      name: string;
      price: number;
      at: number;
      kind: string;
      status: string;
      payload?: string;
    }[]
  >([]);
  useEffect(() => {
    void listMyOrders()
      .then((rows) =>
        setOrders(rows.map((row) => ({ ...row, at: Date.parse(row.created_at), kind: "product" }))),
      )
      .catch(() => setPayError("โหลดประวัติการซื้อไม่สำเร็จ"));
  }, []);
  const [tab, setTab] = useState<"all" | "topup" | "purchase">("all");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payError, setPayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void listMyPayments()
      .then((rows) => {
        setPayments(rows);
        setPayError(null);
      })
      .catch((err) => {
        setPayments([]);
        setPayError(err instanceof Error ? err.message : "โหลดประวัติเติมเงินไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, []);

  const purchaseOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.kind === "product" || o.kind === "box" || o.kind === "wheel" || o.kind === "gift",
      ),
    [orders],
  );
  const localTopups = useMemo(() => orders.filter((o) => o.kind === "topup"), [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "ทั้งหมด"],
            ["topup", "เติมเงิน"],
            ["purchase", "การซื้อ"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-10 rounded-full px-4 text-sm ${tab === id ? "bg-accent text-accent-fg" : "bg-surface shadow-border"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "all" || tab === "topup" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">ประวัติเติมเงิน</h2>
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <Link to="/shop/topup">ไปเติมเงิน</Link>
            </Button>
          </div>
          {loading ? <p className="text-sm text-muted">กำลังโหลด…</p> : null}
          {payError ? <p className="text-sm text-danger">{payError}</p> : null}
          {!loading && payments.length === 0 && localTopups.length === 0 ? (
            <p className="rounded-3xl bg-surface px-5 py-8 text-center text-sm text-muted shadow-border">
              ยังไม่มีรายการเติมเงิน
            </p>
          ) : null}
          <ul className="divide-y divide-border rounded-3xl bg-surface shadow-border">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {p.method === "slip"
                      ? "สลิปพร้อมเพย์"
                      : p.method === "truewallet"
                        ? "True Wallet"
                        : "พร้อมเพย์"}{" "}
                    · {p.provider}
                  </p>
                  <p className="text-xs text-subtle">{formatPaymentTime(p.created_at)}</p>
                  {p.reject_reason ? (
                    <p className="mt-1 text-xs text-danger">{p.reject_reason}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="tabular text-sm">
                    {p.status === "success"
                      ? `+${formatBaht(Number(p.credit))}`
                      : formatBaht(Number(p.amount))}
                  </p>
                  <Badge
                    tone={
                      p.status === "success" ? "ok" : p.status === "rejected" ? "danger" : "warn"
                    }
                  >
                    {statusLabel(p.status)}
                  </Badge>
                </div>
              </li>
            ))}
            {localTopups.map((o) => (
              <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-subtle">{formatTime(o.at)}</p>
                  {o.payload ? <p className="mt-1 text-xs text-muted">{o.payload}</p> : null}
                </div>
                <div className="text-right">
                  <p className="tabular text-sm text-ok">+{formatBaht(o.price)}</p>
                  <Badge tone="ok">สำเร็จ (ท้องถิ่น)</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "all" || tab === "purchase" ? (
        <section className="space-y-3">
          <h2 className="font-medium">ประวัติการซื้อ / กิจกรรม</h2>
          {purchaseOrders.length === 0 ? (
            <p className="rounded-3xl bg-surface px-5 py-8 text-center text-sm text-muted shadow-border">
              ยังไม่มีรายการซื้อ —{" "}
              <Link
                to="/shop/catalog"
                search={{ cat: undefined }}
                className="text-accent underline-offset-2 hover:underline"
              >
                ไปหน้าร้าน
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-3xl bg-surface shadow-border">
              {purchaseOrders.map((o) => (
                <li key={o.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-xs text-subtle">{formatTime(o.at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm">{o.price ? formatBaht(o.price) : "—"}</p>
                      <Badge tone={o.status === "success" ? "ok" : "warn"}>
                        {o.status === "processing" ? "รอจัดส่ง" : o.status}
                      </Badge>
                    </div>
                  </div>
                  {o.status === "completed" ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        void getMyDelivery({ data: { orderId: o.id } })
                          .then((res) => {
                            if (res.ok)
                              setDeliveries((current) => ({ ...current, [o.id]: res.payload }));
                            else setPayError(res.message);
                          })
                          .catch(() => setPayError("โหลดข้อมูลสินค้าไม่สำเร็จ"));
                      }}
                    >
                      ดูสินค้าที่ได้รับ
                    </Button>
                  ) : null}
                  {deliveries[o.id] ? (
                    <pre className="mt-3 whitespace-pre-wrap break-all rounded-md bg-bg p-3 font-mono text-xs select-all">
                      {deliveries[o.id]}
                    </pre>
                  ) : null}
                  {o.payload ? (
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs">
                      {o.payload}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "success") return "สำเร็จ";
  if (s === "pending") return "รอดำเนินการ";
  if (s === "rejected") return "ปฏิเสธ";
  return s;
}

function formatPaymentTime(raw: string) {
  const t = Date.parse(raw);
  if (Number.isFinite(t)) return formatTime(t);
  return raw;
}

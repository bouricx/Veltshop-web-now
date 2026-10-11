import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { listAdminCartRequests, updateCartRequest } from "@/lib/shop/cart-requests";
import { RequestSummary } from "./request-summary";
import { requestStatuses } from "@/lib/shop/cart-presentation";
import { AdminManualCartPayment } from "./admin-manual-cart-payment";
import { AdminCartDelivery } from "./admin-cart-delivery";
import { WalletCards, PackageCheck, RefreshCw } from "lucide-react";
export function AdminCartRequests() {
  const [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [data, setData] = useState<Awaited<ReturnType<typeof listAdminCartRequests>> | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      void listAdminCartRequests({
        data: { status: status as "" | "pending" | "received" | "done" | "cancelled", page },
      })
        .then((v) => {
          if (active) {
            setData(v);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("โหลดรายการไม่สำเร็จ กรุณาลองใหม่");
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [status, page, revision]);
  async function update(
    id: string,
    expectedStatus: string,
    next: "received" | "done" | "cancelled",
  ) {
    if (busy) return;
    setBusy(id);
    try {
      const r = await updateCartRequest({
        data: {
          id,
          expectedStatus: expectedStatus as "pending" | "received" | "done" | "cancelled",
          status: next,
        },
      });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      setRevision((v) => v + 1);
    } catch {
      toast.error("อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <p className="flex items-start gap-2 text-sm">
          <WalletCards className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            <strong className="block">1. ตรวจยอดเงินเข้า</strong>
            <span className="text-xs text-muted">
              ตรวจบัญชีธนาคาร แล้วกรอกเลขอ้างอิงและยืนยันรับเงิน
            </span>
          </span>
        </p>
        <p className="flex items-start gap-2 text-sm">
          <PackageCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="block">2. ส่งสินค้าและยืนยัน</strong>
            <span className="text-xs text-muted">
              ส่งรหัสในเว็บ หรือยืนยันว่าจัดส่งทางเพจแล้ว ระบบแจ้งลูกค้าและตัดสต็อก
            </span>
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <NativeSelect
          className="sm:max-w-64"
          aria-label="กรองรายการจากตะกร้า"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(requestStatuses).map(([key, [label]]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
          <RefreshCw className="size-4" aria-hidden="true" />
          โหลดรายการใหม่
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!data && !error ? <p>กำลังโหลดรายการ…</p> : null}
      {data ? (
        <p className="text-xs text-muted">{data.total} รายการ · อัปเดตทุก 15 วินาที</p>
      ) : null}
      <div className="space-y-4">
        {data?.rows.map((r) => (
          <RequestSummary key={r.id} request={r}>
            {["pending", "received"].includes(r.status) &&
            ["unpaid", "expired", "rejected", "manual_review"].includes(r.payment_status) ? (
              <AdminManualCartPayment
                id={r.id}
                paymentStatus={r.payment_status}
                onResolved={() => setRevision((v) => v + 1)}
              />
            ) : null}
            {r.payment_status === "verifying" ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                กำลังตรวจสลิป กรุณารอผลตรวจหรือสถานะรอแอดมินก่อนยืนยันยอดเงิน
              </p>
            ) : null}
            {["pending", "received"].includes(r.status) ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                {r.payment_status === "paid" ? (
                  <AdminCartDelivery request={r} onDelivered={() => setRevision((v) => v + 1)} />
                ) : null}
                {r.status === "pending" && r.payment_status === "paid" ? (
                  <Button
                    disabled={Boolean(busy) || r.payment_status !== "paid"}
                    onClick={() => void update(r.id, r.status, "received")}
                  >
                    รับเรื่อง
                  </Button>
                ) : null}
                {!["paid", "verifying", "manual_review"].includes(r.payment_status) ? (
                  <Button
                    variant="outline"
                    disabled={
                      Boolean(busy) ||
                      ["paid", "verifying", "manual_review"].includes(r.payment_status)
                    }
                    onClick={() => void update(r.id, r.status, "cancelled")}
                  >
                    ยกเลิกรายการ
                  </Button>
                ) : null}
              </div>
            ) : null}
          </RequestSummary>
        ))}
      </div>
      {data && !data.rows.length ? (
        <p className="rounded-xl bg-surface p-6 text-center text-muted">ไม่มีรายการในสถานะนี้</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((v) => v - 1)}>
          ก่อนหน้า
        </Button>
        <span className="text-sm">หน้า {page + 1}</span>
        <Button
          variant="outline"
          disabled={!data || (page + 1) * 30 >= data.total}
          onClick={() => setPage((v) => v + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </section>
  );
}

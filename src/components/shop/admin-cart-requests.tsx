import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { listAdminCartRequests, updateCartRequest } from "@/lib/shop/cart-requests";
import { RequestSummary } from "./request-summary";
import { requestStatuses } from "@/lib/shop/cart-presentation";
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
      <p className="text-sm text-muted">
        ลูกค้าส่งรายการโดยไม่ชำระเงิน ตรวจสอบสินค้าและติดต่อกลับก่อนตกลงการชำระ
        การเปลี่ยนสถานะนี้ไม่หักเครดิต ไม่ตัดสต็อก และไม่ส่งรหัสสินค้าอัตโนมัติ
      </p>
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
            {["pending", "received"].includes(r.status) ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                {r.status === "pending" ? (
                  <Button
                    disabled={Boolean(busy)}
                    onClick={() => void update(r.id, r.status, "received")}
                  >
                    รับเรื่อง
                  </Button>
                ) : (
                  <Button
                    disabled={Boolean(busy)}
                    onClick={() => void update(r.id, r.status, "done")}
                  >
                    จัดการเรียบร้อยแล้ว
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void update(r.id, r.status, "cancelled")}
                >
                  ยกเลิกรายการ
                </Button>
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

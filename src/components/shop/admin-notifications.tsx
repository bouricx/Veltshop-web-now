import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ArrowUpRight } from "lucide-react";
import { listAdminNotifications, markAdminNotificationRead } from "@/lib/shop/admin-notifications";
import { onShopChange } from "@/lib/shop/realtime-client";
import { Button } from "@/components/ui/button";
const labels: Record<string, [string, string]> = {
  "user.created": ["สมาชิกใหม่", "users"],
  "order.created": ["คำสั่งซื้อใหม่", "orders"],
  "order.completed": ["จัดส่งสินค้าแล้ว", "orders"],
  "topup.created": ["รายการเติมเงินใหม่", "payments"],
  "stock.low": ["สินค้าใกล้หมด", "products"],
  "member.vip": ["สมาชิกถึงเกณฑ์ VIP", "users"],
  "member.vvip": ["สมาชิกถึงเกณฑ์ VVip", "users"],
  "payment.failed": ["การชำระเงินต้องตรวจสอบ", "payments"],
  "job.failed": ["งานเบื้องหลังไม่สำเร็จ", "jobs"],
};
export function AdminNotifications() {
  const [page, setPage] = useState(0),
    [unreadOnly, setUnreadOnly] = useState(false),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<Awaited<ReturnType<typeof listAdminNotifications>> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void listAdminNotifications({ data: { page, unreadOnly } })
        .then((v) => {
          if (active) {
            setData(v);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("โหลดการแจ้งเตือนไม่สำเร็จ");
        });
    load();
    const unsubscribe = onShopChange(load);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [page, unreadOnly, revision]);
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">ยังไม่อ่าน {data?.unread ?? "—"} รายการ</p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(0);
            }}
          />
          เฉพาะที่ยังไม่อ่าน
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {data?.rows.map((event) => {
        const [label, tab] = labels[event.kind] ?? [event.kind, "dashboard"];
        return (
          <article
            key={event.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-4 shadow-border"
          >
            <span
              className={`grid size-10 place-items-center rounded-xl ${event.read ? "bg-bg text-subtle" : "bg-indigo-50 text-indigo-600"}`}
            >
              <Bell className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-1 break-all text-xs text-muted">{event.entity_id}</p>
              <p className="mt-1 text-xs text-subtle">
                {new Date(event.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
              </p>
            </div>
            <div className="flex gap-2">
              {!event.read ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void markAdminNotificationRead({ data: { id: event.id } })
                      .then(() => setRevision((v) => v + 1))
                      .catch(() => setError("บันทึกไม่สำเร็จ"))
                  }
                >
                  อ่านแล้ว
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin" search={{ tab }}>
                  เปิดรายการ
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </article>
        );
      })}
      {data && !data.rows.length ? (
        <p className="rounded-2xl bg-surface p-6 text-sm text-muted">ไม่มีการแจ้งเตือนใหม่</p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          หน้า {page + 1} · {data?.total ?? 0} รายการ
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage((v) => v - 1)}>
            ก่อนหน้า
          </Button>
          <Button
            variant="secondary"
            disabled={!data || (page + 1) * 24 >= data.total}
            onClick={() => setPage((v) => v + 1)}
          >
            ถัดไป
          </Button>
        </div>
      </div>
    </section>
  );
}

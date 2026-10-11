import type { CartRequest } from "@/lib/shop/cart-requests";
import { formatBaht } from "@/lib/utils";
import { requestStatuses } from "@/lib/shop/cart-presentation";
import { CartPaymentPanel } from "./cart-payment-panel";
import { useState } from "react";
export function RequestSummary({
  request: r,
  children,
  showPayment = false,
}: {
  request: CartRequest;
  children?: React.ReactNode;
  showPayment?: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [status, color] = requestStatuses[r.status] ?? ["รอตรวจสอบ", "bg-amber-50 text-amber-900"];
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{status}</span>
        <p className="text-xs text-muted">
          {new Date(r.created_at).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      <p className="mt-3 break-all text-xs text-muted">เลขรายการ: {r.id}</p>
      {r.name ? <p className="mt-3 font-semibold">{r.name}</p> : null}
      {r.email ? <p className="break-all text-sm text-muted">{r.email}</p> : null}
      <p className="mt-2 break-words text-sm">ติดต่อกลับ: {r.contact}</p>
      <ul className="mt-4 divide-y divide-border">
        {r.items.map((i) => (
          <li key={i.productId} className="flex flex-wrap justify-between gap-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">
                {i.name} × {i.quantity}
              </p>
              <p className="mt-1 text-xs text-muted">
                {i.category} · {formatBaht(i.price)} / ชิ้น
              </p>
            </div>
            <span className="text-sm font-semibold">{formatBaht(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right font-semibold">ยอดรายการ {formatBaht(r.total)}</p>
      <p
        className={`mt-1 text-right text-xs font-medium ${r.payment_status === "paid" ? "text-emerald-700" : r.payment_status === "rejected" ? "text-danger" : "text-muted"}`}
      >
        {{
          unpaid: "รอชำระเงิน",
          verifying: "กำลังตรวจสลิป",
          paid: "ยืนยันได้รับเงินแล้ว",
          rejected: "สลิปถูกปฏิเสธ",
          manual_review: "รับสลิปแล้ว · รอแอดมินตรวจ",
          expired: "หมดเวลาชำระเงิน",
        }[r.payment_status] ?? "สถานะชำระเงินไม่ทราบ"}
      </p>
      {showPayment && r.status !== "cancelled" ? (
        <details
          className="mt-4 border-t border-border pt-3"
          onToggle={(e) => setPaymentOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer py-2 text-sm font-semibold">
            {r.payment_status === "paid"
              ? "ดูรายละเอียดการชำระเงิน"
              : "เปิดการชำระเงิน / ส่งสลิป / ดูผลตรวจ"}
          </summary>
          {paymentOpen ? (
            <CartPaymentPanel
              id={r.id}
              paymentStatus={r.payment_status}
              paymentReason={r.payment_reason}
            />
          ) : null}
        </details>
      ) : null}
      {r.note ? (
        <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-sm">
          หมายเหตุ: {r.note}
        </p>
      ) : null}
      {children}
    </article>
  );
}

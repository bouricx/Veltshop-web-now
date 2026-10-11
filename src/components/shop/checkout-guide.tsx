import { useEffect, useState } from "react";
import { CircleCheck, ShoppingBag, QrCode, Upload, PackageCheck, Info } from "lucide-react";
import { getCheckoutReadiness } from "@/lib/shop/cart-requests";
import type { CheckoutReadiness } from "@/lib/shop/payment-policy";

export function CheckoutGuide() {
  const [state, setState] = useState<CheckoutReadiness | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      void getCheckoutReadiness()
        .then((value) => {
          if (active) {
            setState(value);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        });
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const steps = [
    { icon: ShoppingBag, title: "เลือกสินค้า", detail: "เพิ่มลงตะกร้าและตรวจยอด" },
    { icon: QrCode, title: "สแกนจ่าย", detail: "ชำระตามยอดภายใน 5 นาที" },
    { icon: Upload, title: "แจ้งชำระเงิน", detail: "แนบสลิปในเว็บ หรือแคปแจ้งเพจ" },
    { icon: PackageCheck, title: "รับสินค้า", detail: "ดูรหัสในออเดอร์ หรือรับทางเพจ" },
  ];
  return (
    <section
      aria-label="วิธีสั่งซื้อและสถานะชำระเงิน"
      className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">สั่งซื้อง่าย ๆ ใน 4 ขั้นตอน</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          {state?.available ? (
            <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <Info className="size-4" aria-hidden="true" />
          )}
          {error
            ? "กำลังตรวจสถานะร้าน"
            : state
              ? state.available
                ? "เปิดรับออเดอร์"
                : "พักรับชำระเงิน"
              : "กำลังตรวจสถานะร้าน…"}
        </span>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {steps.map(({ icon: Icon, title, detail }, i) => (
          <li key={title} className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {i + 1}. {title}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
          </li>
        ))}
      </ol>
      {state ? (
        <p
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${state.verification === "manual" || !state.available ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {state.message}
            {state.available && state.verification === "manual"
              ? " · อัปโหลดสลิปแล้วติดตามผลที่นี่ได้เลย"
              : ""}
          </span>
        </p>
      ) : null}
    </section>
  );
}

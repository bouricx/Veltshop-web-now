import { useState } from "react";
import { Camera, Copy, Facebook, ArrowUpRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfiguration } from "@/lib/shop/site-state";
import type { RequestItem } from "@/lib/shop/cart-requests";
import { formatBaht } from "@/lib/utils";

export function OrderContactActions({
  id,
  total,
  items = [],
}: {
  id: string;
  total: number;
  items?: RequestItem[];
}) {
  const site = useSiteConfiguration((s) => s.value),
    [message, setMessage] = useState("");
  const summary = [
    "แจ้งรายการสั่งซื้อ VELTSHOP",
    `เลขรายการ: ${id}`,
    ...items.map((i) => `${i.name} × ${i.quantity}`),
    `ยอดรายการ: ${formatBaht(total)}`,
    "รบกวนตรวจยอดเงินและจัดเตรียมสินค้าให้ด้วยครับ/ค่ะ",
  ].join("\n");
  return (
    <section
      aria-label="แจ้งรายการให้ร้านจัดเตรียมสินค้า"
      className="mt-4 rounded-2xl border border-border bg-surface-2 p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="size-4 shrink-0" aria-hidden="true" />
        แจ้งออเดอร์ให้ร้านจัดเตรียมสินค้า
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        แคปหน้ารายการให้เห็นเลขออเดอร์ สินค้า และยอดรวม แล้วกดแจ้งทางเพจพร้อมสลิป
        ร้านจะตรวจยอดเงินและจัดเตรียมสินค้า โดยปกติได้รับสินค้าใน 5–10 นาทีหลังยืนยันยอด
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild className="bg-[#111111] text-white hover:bg-[#27272a]">
          <a href={site.facebook} target="_blank" rel="noreferrer">
            <Facebook className="size-4" aria-hidden="true" />
            แจ้งออเดอร์ทางเพจ
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(summary)
              .then(() => setMessage("คัดลอกรายการแล้ว วางข้อความพร้อมภาพแคปในแชตเพจได้เลย"))
              .catch(() => setMessage("คัดลอกไม่ได้ กรุณาแคปหน้ารายการส่งให้เพจ"))
          }
        >
          <Copy className="size-4" aria-hidden="true" />
          คัดลอกรายการ
        </Button>
        <Button asChild variant="ghost">
          <a href={site.discord} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" aria-hidden="true" />
            Discord
          </a>
        </Button>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-xs text-muted">
          {message}
        </p>
      ) : null}
    </section>
  );
}

import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyCartDelivery } from "@/lib/shop/cart-requests";

export function CartOrderDelivery({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyCartDelivery>>>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function reveal() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const value = await getMyCartDelivery({ data: { id } });
      setData(value);
      if (!value) setMessage("ยังไม่พบข้อมูลสินค้า กรุณาติดต่อร้านพร้อมเลขรายการ");
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="สินค้าที่ได้รับ"
      className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <PackageCheck className="size-5" aria-hidden="true" />
        สินค้าพร้อมใช้งานแล้ว
      </h3>
      <p className="mt-1 text-sm">เปิดดูข้อมูลสินค้าและวิธีใช้งานที่ร้านส่งให้ได้ที่นี่</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 bg-white text-emerald-950"
        disabled={busy}
        onClick={() => (data ? setData(null) : void reveal())}
      >
        {data ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
        {data ? "ซ่อนข้อมูลสินค้า" : busy ? "กำลังโหลด…" : "ดูข้อมูลสินค้า / รหัสผ่าน"}
      </Button>
      {data ? (
        <ul className="mt-4 space-y-3">
          {data.entries.map((i) => (
            <li
              key={i.productId}
              className="min-w-0 rounded-xl border border-emerald-200 bg-white p-4"
            >
              <h4 className="flex items-start gap-2 text-sm font-semibold">
                <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {i.name} × {i.quantity}
              </h4>
              <pre className="mt-3 whitespace-pre-wrap break-all font-sans text-sm leading-relaxed">
                {i.payload}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 text-emerald-950"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(i.payload)
                    .then(() => setMessage("คัดลอกข้อมูลแล้ว"))
                    .catch(() => setMessage("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความด้วยตนเอง"))
                }
              >
                <Copy className="size-4" aria-hidden="true" />
                คัดลอกข้อมูลสินค้า
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

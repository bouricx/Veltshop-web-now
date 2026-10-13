import { useEffect, useState } from "react";
import { BookOpen, Copy, Eye, EyeOff, KeyRound, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyCartDelivery, getAdminCartDelivery } from "@/lib/shop/cart-requests";
import { defaultAppUsageGuide } from "@/lib/shop/app-usage-guide";
import { onShopChange } from "@/lib/shop/realtime-client";

export function CartOrderDelivery({ id, admin = false }: { id: string; admin?: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyCartDelivery>>>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const revealed = Boolean(data);
  useEffect(() => {
    if (!revealed || admin) return;
    let active = true,
      fetching = false;
    const refresh = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const value = await getMyCartDelivery({ data: { id } });
        if (active) {
          setData(value);
          if (!value)
            setMessage("ข้อมูลสินค้าไม่พร้อมใช้งาน กรุณาตรวจรายการล่าสุดหรือติดต่อทีมงาน");
        }
      } catch {
        if (active) {
          setData(null);
          setMessage("เปิดดูข้อมูลสินค้าอีกครั้งเพื่อยืนยันข้อมูลล่าสุด");
        }
      } finally {
        fetching = false;
      }
    };
    const timer = setInterval(() => void refresh(), 15000);
    const unsubscribe = onShopChange(() => void refresh());
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, [revealed, admin, id]);
  async function reveal() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const value = await (admin ? getAdminCartDelivery : getMyCartDelivery)({ data: { id } });
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
        {admin
          ? "ข้อมูลสินค้าที่ส่งให้ลูกค้า · ตรวจสิทธิ์และบันทึกการเปิดดู"
          : "สินค้าพร้อมใช้งานแล้ว"}
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
        {data ? "ซ่อนข้อมูลสินค้า" : busy ? "กำลังโหลด…" : "ดูสินค้า / รหัส / วิธีใช้งาน"}
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
              {i.payload ? (
                <>
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
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  ข้อมูลเข้าสู่ระบบจัดส่งผ่านช่องทางที่ร้านยืนยันไว้ในออเดอร์
                </p>
              )}
              <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-fg">
                <h5 className="flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                  วิธีใช้งาน {i.name}
                </h5>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {i.instructions || defaultAppUsageGuide(i.name)}
                </p>
              </div>
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

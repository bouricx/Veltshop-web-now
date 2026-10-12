import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAdminOrderDelivery } from "@/lib/shop/inventory";
import { Eye, EyeOff, Copy } from "lucide-react";
export function AdminOrderSecret({ id }: { id: string }) {
  const [payload, setPayload] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="w-full">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          if (payload !== null) {
            setPayload(null);
            return;
          }
          setBusy(true);
          try {
            const r = await getAdminOrderDelivery({ data: { orderId: id } });
            setPayload(r);
            if (r === null) setMessage("ยังไม่มีข้อมูลส่งมอบ");
          } catch {
            setMessage("ไม่มีสิทธิ์หรือโหลดรหัสสินค้าไม่ได้");
          } finally {
            setBusy(false);
          }
        }}
      >
        {payload === null ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {busy ? "กำลังโหลด…" : payload === null ? "เปิดดูรหัสสินค้าที่ส่งมอบ" : "ซ่อนรหัสสินค้า"}
      </Button>
      {payload !== null ? (
        <div className="mt-2 rounded-xl border border-border p-3">
          <pre className="whitespace-pre-wrap break-all font-sans text-xs">{payload}</pre>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void navigator.clipboard
                .writeText(payload)
                .then(() => setMessage("คัดลอกแล้ว"))
                .catch(() => setMessage("คัดลอกไม่ได้"))
            }
          >
            <Copy className="size-4" />
            คัดลอก
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}

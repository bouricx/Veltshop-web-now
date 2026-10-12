import { useEffect, useRef, useState } from "react";
import { Gift, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { redeemGiftCode } from "@/lib/shop/operations";
import { listMyOrders } from "@/lib/shop/actions";
import { getMyDelivery } from "@/lib/shop/inventory";
import { Link } from "@tanstack/react-router";
export function GiftCodePanel({ products }: { products: { productId: string; name: string }[] }) {
  const [code, setCode] = useState(""),
    [productId, setProductId] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [orders, setOrders] = useState<Awaited<ReturnType<typeof listMyOrders>>>([]),
    [revision, setRevision] = useState(0),
    [payloads, setPayloads] = useState<Record<string, string>>({});
  const retry = useRef<{ code: string; productId: string; key: string } | null>(null);
  useEffect(() => {
    void listMyOrders()
      .then(setOrders)
      .catch(() => {});
  }, [revision]);
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Gift className="size-5 text-accent" />
        โค้ดรับสินค้า / โค้ดเครดิต
      </h2>
      <p className="mt-2 text-sm text-muted">
        แยกจากโค้ดส่วนลด รางวัลจะใช้ตามเงื่อนไขที่ร้านกำหนด โค้ดเครดิตเพิ่มกระเป๋าเครดิต
        ไม่ลดค่าชำระ QR อัตโนมัติ
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          const trimmed = code.trim();
          if (retry.current?.code !== trimmed || retry.current?.productId !== productId)
            retry.current = { code: trimmed, productId, key: crypto.randomUUID() };
          try {
            const r = await redeemGiftCode({
              data: { code: trimmed, key: retry.current.key, ...(productId ? { productId } : {}) },
            });
            if (r.ok) {
              setMessage(
                r.result.orderId
                  ? "รับสินค้าแล้ว ดูสถานะด้านล่าง"
                  : "ใช้โค้ดแล้ว ตรวจยอดเครดิตในหน้าสมาชิก",
              );
              setCode("");
              retry.current = null;
              setRevision((v) => v + 1);
            } else setMessage(r.message);
          } catch {
            setMessage("ยังยืนยันผลไม่ได้ กรุณาลองใหม่ด้วยโค้ดเดิม");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label htmlFor="gift-code">โค้ดรับสินค้า / เครดิต</Label>
        <div className="flex gap-2">
          <Input
            id="gift-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            minLength={6}
            maxLength={128}
            required
            placeholder="กรอกโค้ดที่ได้รับ"
            disabled={busy}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "กำลังตรวจ…" : "ใช้โค้ด"}
          </Button>
        </div>
        {products.length ? (
          <>
            <Label htmlFor="gift-product">เลือกสินค้า เฉพาะโค้ดที่รับได้ตามหมวด</Label>
            <NativeSelect
              id="gift-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={busy}
            >
              <option value="">ใช้สินค้าที่กำหนดไว้ในโค้ด</option>
              {products.map((p) => (
                <option value={p.productId} key={p.productId}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setCode("");
            setProductId("");
            setMessage("");
            retry.current = null;
          }}
        >
          ล้างโค้ด
        </Button>
      </form>
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
      {orders.length ? (
        <div className="mt-5 space-y-3">
          <h3 className="font-semibold">สินค้าที่รับผ่านโค้ด / เครดิตเดิม</h3>
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl border border-border p-4">
              <p className="font-medium">{o.name}</p>
              <p className="mt-1 break-all text-xs text-muted">
                {o.id} · {o.status === "completed" ? "ส่งมอบแล้ว" : "รอดำเนินการ"}
              </p>
              {o.status === "completed" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={async () => {
                    if (payloads[o.id]) {
                      setPayloads((p) => ({ ...p, [o.id]: "" }));
                      return;
                    }
                    try {
                      const r = await getMyDelivery({ data: { orderId: o.id } });
                      if (r.ok) setPayloads((p) => ({ ...p, [o.id]: r.payload }));
                      else setMessage(r.message);
                    } catch {
                      setMessage("โหลดข้อมูลส่งมอบไม่ได้");
                    }
                  }}
                >
                  {payloads[o.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {payloads[o.id] ? "ซ่อนรหัส" : "เปิดดูรหัสสินค้า"}
                </Button>
              ) : null}
              {payloads[o.id] ? (
                <>
                  <pre className="mt-3 whitespace-pre-wrap break-all font-sans text-sm">
                    {payloads[o.id]}
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(payloads[o.id])
                        .then(() => setMessage("คัดลอกแล้ว"))
                        .catch(() => setMessage("คัดลอกไม่ได้ กรุณาเลือกข้อความ"))
                    }
                  >
                    <Copy className="size-4" />
                    คัดลอก
                  </Button>
                </>
              ) : null}
              <Link to="/shop/claims" className="mt-3 block text-sm text-accent underline">
                เคลมสินค้า / ตรวจประกัน
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

import { useRef, useState } from "react";
import { PackageCheck, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { deliverCartRequest, type CartRequest } from "@/lib/shop/cart-requests";

export function AdminCartDelivery({
  request: r,
  onDelivered,
}: {
  request: CartRequest;
  onDelivered: () => void;
}) {
  const [open, setOpen] = useState(false),
    [channel, setChannel] = useState<"web" | "facebook" | "discord">("web");
  const [values, setValues] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const sending = useRef(false);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending.current || !confirmed || !["pending", "received"].includes(r.status)) return;
    const missing = channel === "web" ? r.items.find((i) => !values[i.productId]?.trim()) : null;
    if (missing) {
      setMessage(`กรอกข้อมูล ${missing.name} ให้ครบก่อนส่ง`);
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await deliverCartRequest({
        data: {
          id: r.id,
          expectedStatus: r.status as "pending" | "received",
          channel,
          entries:
            channel === "web"
              ? r.items.map((i) => ({
                  productId: i.productId,
                  payload: values[i.productId]?.trim() ?? "",
                }))
              : [],
          confirmedDelivered: true,
        },
      });
      setMessage(result.message);
      if (result.ok) {
        setValues({});
        setConfirmed(false);
        setOpen(false);
        onDelivered();
      }
    } catch {
      setMessage("ยังยืนยันผลการส่งไม่ได้ กรุณาโหลดรายการก่อนส่งซ้ำ");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setOpen(v);
          if (!v) {
            setValues({});
            setConfirmed(false);
            setMessage("");
          }
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-[#111111] text-white hover:bg-[#27272a]">
          <Send className="size-4" aria-hidden="true" />
          ส่งสินค้า / รหัสให้ลูกค้า
        </Button>
      </DialogTrigger>
      <DialogContent
        title="ส่งสินค้าและยืนยันจัดส่ง"
        className="max-h-[85dvh] overflow-y-auto sm:w-[min(92vw,40rem)]"
      >
        <form onSubmit={(e) => void send(e)} className="space-y-4">
          <p className="break-all text-xs text-muted">เลขรายการ {r.id}</p>
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
            <ShieldCheck className="mr-2 inline size-4" aria-hidden="true" />
            ยืนยันได้รับเงินแล้ว · พร้อมจัดส่ง {r.items.reduce((n, i) => n + i.quantity, 0)} ชิ้น
          </div>
          <label className="block text-sm font-medium">
            ช่องทางจัดส่ง
            <NativeSelect
              className="mt-2"
              value={channel}
              disabled={busy}
              onChange={(e) => {
                setChannel(e.target.value as typeof channel);
                setConfirmed(false);
              }}
            >
              <option value="web">ส่งข้อมูลสินค้าในเว็บ</option>
              <option value="facebook">จัดส่งทาง Facebook Page แล้ว</option>
              <option value="discord">จัดส่งทาง Discord แล้ว</option>
            </NativeSelect>
          </label>
          {channel === "web" ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-muted">
                ใส่อีเมล รหัสสินค้า รหัสผ่าน หรือวิธีใช้งานให้ครบตามจำนวน
                ลูกค้าจะเปิดดูได้จากออเดอร์ของตัวเอง
              </p>
              {r.items.map((i) => (
                <label key={i.productId} className="block text-sm font-medium">
                  {i.name} × {i.quantity}
                  <Textarea
                    className="mt-2 min-h-32"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    maxLength={10000}
                    disabled={busy}
                    value={values[i.productId] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [i.productId]: e.target.value }))}
                    placeholder={`ข้อมูลสำหรับ ${i.quantity} ชุด เช่น อีเมล / รหัสผ่าน / วิธีใช้งาน`}
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
              ส่งสินค้าให้ลูกค้าทาง {channel === "facebook" ? "Facebook Page" : "Discord"}{" "}
              ให้เรียบร้อยก่อนยืนยัน ปุ่มนี้จะบันทึกสถานะจัดส่งในเว็บ
            </p>
          )}
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {channel === "web"
                ? "ตรวจข้อมูลและจำนวนครบแล้ว พร้อมส่งให้ลูกค้า"
                : "จัดส่งสินค้าครบทุกชิ้นทางช่องทางที่เลือกแล้ว"}
            </span>
          </label>
          {message ? (
            <p role="status" className="text-sm text-danger">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full bg-[#111111] text-white hover:bg-[#27272a]"
            disabled={busy || !confirmed}
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            {busy
              ? "กำลังบันทึก…"
              : channel === "web"
                ? "ส่งข้อมูลและยืนยันจัดส่ง"
                : "ยืนยันจัดส่งแล้ว"}
          </Button>
          <p className="text-center text-xs text-muted">
            ระบบแจ้งลูกค้าและตัดสต็อกเมื่อยืนยันสำเร็จ
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

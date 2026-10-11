import { useEffect, useRef, useState } from "react";
import { PackageCheck, Save, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { deliverCartRequest, type CartRequest } from "@/lib/shop/cart-requests";
import { defaultAppUsageGuide } from "@/lib/shop/app-usage-guide";
import {
  getAdminProductUsageGuides,
  saveAdminProductUsageGuides,
} from "@/lib/shop/product-usage-guides";

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
  const [guides, setGuides] = useState<Record<string, string>>({});
  const [savedGuides, setSavedGuides] = useState<Record<string, string>>({});
  const [guideVersions, setGuideVersions] = useState<Record<string, number>>({});
  const [guidesReady, setGuidesReady] = useState(false);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesSaving, setGuidesSaving] = useState(false);
  const [guideMessage, setGuideMessage] = useState("");
  const [guideReload, setGuideReload] = useState(0);
  const guideProducts = JSON.stringify(
    r.items.map((i) => ({ productId: i.productId, name: i.name })),
  );
  useEffect(() => {
    if (!open) return;
    let active = true;
    const items = JSON.parse(guideProducts) as { productId: string; name: string }[];
    setGuidesLoading(true);
    setGuidesReady(false);
    setGuideMessage("");
    void getAdminProductUsageGuides({ data: { productIds: items.map((i) => i.productId) } })
      .then((rows) => {
        if (!active) return;
        const next = Object.fromEntries(
          items.map((i) => [
            i.productId,
            rows.find((g) => g.product_id === i.productId)?.instructions ??
              defaultAppUsageGuide(i.name),
          ]),
        );
        setGuides(next);
        setSavedGuides(next);
        setGuideVersions(Object.fromEntries(rows.map((g) => [g.product_id, g.version])));
        setGuidesReady(true);
      })
      .catch(() => {
        if (active) setGuideMessage("โหลดวิธีใช้งานที่บันทึกไม่สำเร็จ กรุณาลองโหลดใหม่");
      })
      .finally(() => {
        if (active) setGuidesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, guideProducts, guideReload]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const sending = useRef(false);
  const guidesChanged = r.items.some(
    (i) => !guideVersions[i.productId] || guides[i.productId] !== savedGuides[i.productId],
  );
  async function saveGuides() {
    if (sending.current || !guidesReady || !guidesChanged) return;
    if (r.items.some((i) => !guides[i.productId]?.trim())) {
      setGuideMessage("กรอกวิธีใช้งานให้ครบก่อนบันทึก");
      return;
    }
    sending.current = true;
    setGuidesSaving(true);
    setGuideMessage("");
    try {
      const result = await saveAdminProductUsageGuides({
        data: {
          guides: r.items.map((i) => ({
            productId: i.productId,
            instructions: guides[i.productId].trim(),
            expectedVersion: guideVersions[i.productId] ?? 0,
          })),
        },
      });
      setGuideMessage(result.message);
      if (result.ok) {
        const next = Object.fromEntries(result.guides.map((g) => [g.product_id, g.instructions]));
        setGuides(next);
        setSavedGuides(next);
        setGuideVersions(Object.fromEntries(result.guides.map((g) => [g.product_id, g.version])));
      }
    } catch {
      setGuideMessage("ยังยืนยันผลการบันทึกไม่ได้ เก็บข้อความไว้แล้วโหลดฉบับที่บันทึกก่อนลองใหม่");
    } finally {
      sending.current = false;
      setGuidesSaving(false);
    }
  }
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      sending.current ||
      !guidesReady ||
      !confirmed ||
      !["pending", "received"].includes(r.status)
    )
      return;
    const missing = channel === "web" ? r.items.find((i) => !values[i.productId]?.trim()) : null;
    if (missing) {
      setMessage(`กรอกข้อมูล ${missing.name} ให้ครบก่อนส่ง`);
      return;
    }
    const missingGuide = r.items.find(
      (i) => !(guides[i.productId] ?? defaultAppUsageGuide(i.name)).trim(),
    );
    if (missingGuide) {
      setMessage(`กรอกวิธีใช้งาน ${missingGuide.name} ก่อนยืนยันจัดส่ง`);
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
          entries: r.items.map((i) => ({
            productId: i.productId,
            payload: channel === "web" ? (values[i.productId]?.trim() ?? "") : "",
            instructions: (guides[i.productId] ?? defaultAppUsageGuide(i.name)).trim(),
          })),
          confirmedDelivered: true,
        },
      });
      setMessage(result.message);
      if (result.ok) {
        setValues({});
        setGuides({});
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
        if (!busy && !guidesSaving) {
          setOpen(v);
          if (!v) {
            setValues({});
            setGuides({});
            setGuidesReady(false);
            setGuideMessage("");
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
              disabled={busy || guidesSaving}
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
                    disabled={busy || guidesSaving}
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
          <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-sm font-semibold">วิธีใช้งานหลังรับสินค้า</p>
            <p className="text-xs leading-relaxed text-muted">
              แก้คำแนะนำให้ตรงกับแอป แพ็กเกจ และวิธีรับสิทธิ์ที่ขาย
              แล้วบันทึกไว้ใช้กับสินค้านี้ครั้งต่อไป ลูกค้าจะเห็นในออเดอร์หลังยืนยันจัดส่ง
              แม้รับรหัสทางเพจหรือ Discord
            </p>
            <p className="text-xs text-muted">
              บันทึกเฉพาะคำแนะนำทั่วไป ห้ามใส่อีเมล รหัสผ่าน หรือข้อมูลเฉพาะลูกค้า
              ปุ่มนี้ไม่ส่งสินค้าและไม่ตัดสต็อก
            </p>
            {guidesLoading ? (
              <p role="status" className="text-sm">
                กำลังโหลดวิธีใช้งานที่บันทึก…
              </p>
            ) : null}
            {r.items.map((i) => (
              <label key={i.productId} className="block text-sm font-medium">
                วิธีใช้งาน {i.name}
                <Textarea
                  className="mt-2 min-h-40"
                  required
                  maxLength={10000}
                  disabled={busy || guidesSaving || !guidesReady}
                  value={guides[i.productId] ?? defaultAppUsageGuide(i.name)}
                  onChange={(e) => {
                    setGuides((v) => ({ ...v, [i.productId]: e.target.value }));
                    setGuideMessage("");
                  }}
                />
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || guidesSaving || !guidesReady || !guidesChanged}
                onClick={() => void saveGuides()}
              >
                <Save className="size-4" aria-hidden="true" />
                {guidesSaving ? "กำลังบันทึก…" : "บันทึกวิธีใช้งาน"}
              </Button>
              {guideMessage ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || guidesSaving || guidesLoading}
                  onClick={() => setGuideReload((n) => n + 1)}
                >
                  โหลดฉบับที่บันทึก
                </Button>
              ) : null}
            </div>
            {guideMessage ? (
              <p role="status" className="text-sm leading-relaxed">
                {guideMessage}
              </p>
            ) : null}
            {guidesReady && !guidesSaving ? (
              <p className="text-xs text-muted">
                {guidesChanged
                  ? "มีคำแนะนำที่ยังไม่ได้บันทึกสำหรับครั้งต่อไป"
                  : "คำแนะนำนี้บันทึกไว้แล้ว"}{" "}
                · การแก้คำแนะนำไม่เปลี่ยนออเดอร์ที่ส่งไปแล้ว
              </p>
            ) : null}
          </div>
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0"
              checked={confirmed}
              disabled={busy || guidesSaving || !guidesReady}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {channel === "web"
                ? "ตรวจข้อมูล จำนวน และวิธีใช้งานครบแล้ว พร้อมส่งให้ลูกค้า"
                : "จัดส่งสินค้าครบแล้ว และตรวจวิธีใช้งานตรงกับสินค้าที่ขาย"}
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
            disabled={busy || guidesSaving || !guidesReady || !confirmed}
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

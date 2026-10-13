import { useEffect, useRef, useState } from "react";
import { History, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea, Label } from "@/components/ui/input";
import { getAdminDeliveryEditor, saveAdminDeliveryCorrection } from "@/lib/shop/order-support";
import { SHOP_CHANGED } from "@/lib/shop/realtime-client";
type Snapshot = Awaited<ReturnType<typeof getAdminDeliveryEditor>>;
export default function AdminDeliveryCorrectionEditor({
  id,
  onBusy,
  onSaved,
}: {
  id: string;
  onBusy: (busy: boolean) => void;
  onSaved: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [entries, setEntries] = useState<Snapshot["entries"]>([]);
  const [channel, setChannel] = useState<Snapshot["channel"]>("web"),
    [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const retry = useRef<{ key: string; signature: string } | null>(null),
    saving = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    void getAdminDeliveryEditor({ data: { id } })
      .then((value) => {
        if (active) {
          setSnapshot(value);
          setEntries(value.entries);
          setChannel(value.channel);
          setConfirmed(false);
          retry.current = null;
        }
      })
      .catch(() => {
        if (active) {
          setSnapshot(null);
          setMessage("โหลดข้อมูลส่งมอบไม่ได้ กรุณาตรวจสิทธิ์และลองใหม่");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, reload]);
  async function save() {
    if (!snapshot || saving.current || !confirmed) return;
    const data = {
      id,
      expectedVersion: snapshot.version,
      reason: reason.trim(),
      channel,
      entries: entries.map((line) => ({
        productId: line.productId,
        payload: channel === "web" ? line.payload.trim() : "",
        instructions: (line.instructions ?? "").trim(),
      })),
      confirmed: true as const,
    };
    const signature = JSON.stringify(data);
    if (retry.current?.signature !== signature)
      retry.current = { key: crypto.randomUUID(), signature };
    saving.current = true;
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      const result = await saveAdminDeliveryCorrection({
        data: { ...data, key: retry.current!.key },
      });
      setMessage(result.message);
      if (result.ok) {
        window.dispatchEvent(new Event(SHOP_CHANGED));
        onSaved();
      }
    } catch {
      setMessage(
        "ยังยืนยันผลการบันทึกไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาลองบันทึกข้อมูลเดิมอีกครั้ง",
      );
    } finally {
      saving.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="break-all text-xs text-muted">เลขรายการ {id}</p>
      <p className="rounded-xl bg-surface-2 p-3 text-sm text-fg">
        ลูกค้าจะเห็นข้อมูลฉบับใหม่หลังบันทึก การแก้ไขนี้ไม่คิดเงินหรือตัดสต๊อกเพิ่ม
        และไม่เริ่มระยะประกันใหม่
      </p>
      {loading ? <p role="status">กำลังโหลดข้อมูลที่ส่งล่าสุด…</p> : null}
      {message ? (
        <p role="status" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading || busy}
        onClick={() => setReload((value) => value + 1)}
      >
        <RefreshCw className="size-4" />
        โหลดฉบับล่าสุด (แทนที่ช่องข้อมูล)
      </Button>
      {snapshot && !loading ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block text-sm font-medium">
            ช่องทางจัดส่ง
            <NativeSelect
              className="mt-2"
              value={channel}
              disabled={busy}
              onChange={(event) => {
                setChannel(event.target.value as Snapshot["channel"]);
                setConfirmed(false);
              }}
            >
              <option value="web">แสดงข้อมูลสินค้าในเว็บ</option>
              <option value="facebook">จัดส่งทาง Facebook Page</option>
              <option value="discord">จัดส่งทาง Discord</option>
            </NativeSelect>
          </label>
          {channel !== "web" ? (
            <p className="rounded-xl border border-border p-3 text-xs text-muted">
              เมื่อบันทึกช่องทางภายนอก รหัสสินค้าในเว็บจะถูกซ่อน ลูกค้ายังเห็นวิธีใช้งาน
              และข้อมูลเดิมเก็บไว้ในประวัติการแก้ไข
            </p>
          ) : null}
          {!entries.length ? (
            <p className="text-sm text-muted">ไม่มีข้อมูลสินค้าที่ยังแก้ไขได้ อาจคืนเงินครบแล้ว</p>
          ) : null}
          {entries.map((line, index) => (
            <section key={line.productId} className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">
                {line.name} × {line.quantity}
              </h3>
              {channel === "web" ? (
                <label className="block text-sm">
                  ข้อมูลสินค้า / รหัสที่ลูกค้าจะได้รับ
                  <Textarea
                    className="mt-2"
                    value={line.payload}
                    required
                    disabled={busy}
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={10000}
                    onChange={(event) => {
                      setEntries((previous) =>
                        previous.map((entry, n) =>
                          n === index ? { ...entry, payload: event.target.value } : entry,
                        ),
                      );
                      setConfirmed(false);
                    }}
                  />
                </label>
              ) : null}
              <label className="block text-sm">
                วิธีใช้งาน
                <Textarea
                  className="mt-2"
                  value={line.instructions ?? ""}
                  required
                  disabled={busy}
                  maxLength={10000}
                  onChange={(event) => {
                    setEntries((previous) =>
                      previous.map((entry, n) =>
                        n === index ? { ...entry, instructions: event.target.value } : entry,
                      ),
                    );
                    setConfirmed(false);
                  }}
                />
              </label>
            </section>
          ))}
          <div>
            <Label htmlFor={`correction-reason-${id}`}>เหตุผลที่แก้ไข</Label>
            <Textarea
              id={`correction-reason-${id}`}
              className="mt-2 min-h-20"
              value={reason}
              minLength={3}
              maxLength={500}
              required
              disabled={busy}
              placeholder="เช่น แก้รหัสสินค้าให้ถูกต้อง หรือปรับวิธีใช้งาน"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1 size-4 shrink-0"
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            ตรวจข้อมูลครบแล้ว และยืนยันให้ลูกค้าใช้ข้อมูลฉบับใหม่นี้
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={busy || !confirmed || reason.trim().length < 3 || !entries.length}
          >
            <Save className="size-4" />
            {busy ? "กำลังบันทึก…" : "บันทึกข้อมูลใหม่และแจ้งลูกค้า"}
          </Button>
          {snapshot.history.length ? (
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                <History className="mr-2 inline size-4" />
                ประวัติการแก้ไขล่าสุด (สูงสุด 20 ครั้ง)
              </summary>
              <ol className="mt-3 space-y-3">
                {snapshot.history.map((edit) => (
                  <li key={edit.id} className="border-t border-border pt-3 text-sm">
                    <p>
                      {edit.name} ·{" "}
                      {new Date(edit.at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted">{edit.reason}</p>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

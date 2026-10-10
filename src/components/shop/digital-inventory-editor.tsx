import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import {
  addDigitalInventory,
  listDigitalInventory,
  importDigitalInventory,
} from "@/lib/shop/inventory";
import type { Product } from "@/lib/shop/catalog";

export function DigitalInventoryEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payload, setPayload] = useState("");
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<
    { id: string; status: string; order_id: string | null; created_at: string }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setPayload("");
    setItems([]);
    setError("");
    if (!product) return;
    let active = true;
    void listDigitalInventory({ data: { productId: product.id } })
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setError("โหลดสต็อกไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [product]);
  async function add() {
    if (!product || !payload.trim() || busy) return;
    setBusy(true);
    try {
      const result = bulk
        ? await importDigitalInventory({
            data: {
              productId: product.id,
              payloads: payload
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            },
          })
        : await addDigitalInventory({ data: { productId: product.id, payload } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPayload("");
      toast.success(result.message);
      onSaved();
      setItems(await listDigitalInventory({ data: { productId: product.id } }));
    } catch {
      toast.error("เพิ่มสต็อกไม่สำเร็จ โปรดตรวจการตั้งค่าระบบเข้ารหัส");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open) {
          setPayload("");
          onClose();
        }
      }}
    >
      <DialogContent title={`สต็อกดิจิทัล · ${product?.name ?? ""}`}>
        <p className="text-sm text-muted">
          เพิ่มข้อมูลสำหรับส่งให้ลูกค้า 1 ชิ้นต่อครั้ง ระบบจะนับสต็อกจากชิ้นที่พร้อมขายแทนจำนวนเดิม
          เมื่อซื้อสำเร็จลูกค้าจะได้รับข้อมูลนี้
        </p>
        <label className="block text-sm">
          <input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} />{" "}
          นำเข้าหลายชิ้น (1 บรรทัดต่อชิ้น สูงสุด 200 ชิ้น)
        </label>
        <Label htmlFor="digital-payload">บัญชี / รหัส / ข้อความส่งสินค้า</Label>
        <Textarea
          id="digital-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          maxLength={20000}
          autoComplete="off"
          placeholder="ใส่ข้อมูลสินค้าจริง 1 ชิ้น"
        />
        <Button onClick={() => void add()} disabled={busy || !payload.trim()}>
          {busy ? "กำลังบันทึก…" : "ยืนยันเพิ่มสต็อกจริง"}
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="max-h-52 overflow-auto space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีสต็อกรายชิ้น</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-2 text-xs">
                <span>
                  {item.status === "available"
                    ? "พร้อมขาย"
                    : item.status === "sold"
                      ? "ขายแล้ว"
                      : item.status === "reserved"
                        ? "จองแล้ว"
                        : "ปิดใช้งาน"}
                </span>
                <span className="ml-2 text-muted">{item.id.slice(0, 8)}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

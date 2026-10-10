import { ImageEditor } from "./image-editor";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { listAllCategories, saveCategory, type CategoryRow } from "@/lib/shop/actions";

export function CategoryEditor({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listAllCategories()
      .then(setRows)
      .catch((err) => toast.error(err instanceof Error ? err.message : "โหลดหมวดไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open]);

  function patch(id: string, partial: Partial<CategoryRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  }

  async function saveOne(row: CategoryRow) {
    setBusy(true);
    try {
      const res = await saveCategory({
        data: {
          id: row.id,
          label: row.label,
          hint: row.hint,
          sort_order: Number(row.sort_order) || 0,
          visible: Boolean(row.visible),
          image: row.image ?? "",
          icon: row.icon ?? "",
          color: row.color ?? "#18181b",
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    setBusy(true);
    try {
      for (const row of rows) {
        const res = await saveCategory({
          data: {
            id: row.id,
            label: row.label,
            hint: row.hint,
            sort_order: Number(row.sort_order) || 0,
            visible: Boolean(row.visible),
            image: row.image ?? "",
            icon: row.icon ?? "",
            color: row.color ?? "#18181b",
          },
        });
        if (!res.ok) {
          toast.error(`${row.id}: ${res.message}`);
          return;
        }
      }
      toast.success("บันทึกหมวดทั้งหมดแล้ว");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function addCategory() {
    const nextId = `cat-${Date.now().toString(36)}`;
    const nextRow: CategoryRow = {
      id: nextId,
      label: "หมวดใหม่",
      hint: "New category",
      sort_order: rows.length,
      visible: true,
    };
    setRows((prev) => [...prev, nextRow]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="แก้ไขหมวดสินค้า"
        className="max-h-[85dvh] max-w-lg overflow-y-auto rounded-3xl bg-surface p-5 shadow-border sm:p-6"
      >
        <p className="mt-1 text-sm text-muted">
          แก้ชื่อปุ่มหมวดบนหน้าร้านได้ (รหัสหมวดคงที่ เพราะผูกกับสินค้า)
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-muted">กำลังโหลด…</p>
        ) : (
          <div className="mt-4 space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl bg-bg p-3 shadow-border">
                <p className="font-mono text-xs text-subtle">{row.id}</p>
                <div className="mt-2 space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor={`label-${row.id}`}>ชื่อที่แสดง</Label>
                    <Input
                      id={`label-${row.id}`}
                      value={row.label}
                      onChange={(e) => patch(row.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`hint-${row.id}`}>คำอธิบายสั้น</Label>
                    <Input
                      id={`hint-${row.id}`}
                      value={row.hint}
                      onChange={(e) => patch(row.id, { hint: e.target.value })}
                    />
                  </div>
                  <ImageEditor
                    kind="category"
                    value={row.image}
                    onSaved={(image) => patch(row.id, { image })}
                  />
                  <Label htmlFor={`icon-${row.id}`}>ไอคอน / อีโมจิ</Label>
                  <Input
                    id={`icon-${row.id}`}
                    maxLength={20}
                    value={row.icon ?? ""}
                    onChange={(e) => patch(row.id, { icon: e.target.value })}
                  />
                  <Label htmlFor={`color-${row.id}`}>สีหมวด</Label>
                  <Input
                    id={`color-${row.id}`}
                    type="color"
                    value={row.color ?? "#18181b"}
                    onChange={(e) => patch(row.id, { color: e.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`sort-${row.id}`}>ลำดับ</Label>
                      <Input
                        id={`sort-${row.id}`}
                        className="w-24"
                        type="number"
                        value={row.sort_order}
                        onChange={(e) => patch(row.id, { sort_order: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <label className="mt-5 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(row.visible)}
                        onChange={(e) => patch(row.id, { visible: e.target.checked })}
                      />
                      แสดงบนร้าน
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-5 rounded-full"
                      disabled={busy}
                      onClick={() => void saveOne(row)}
                    >
                      บันทึกแถวนี้
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            disabled={busy || loading}
            onClick={addCategory}
          >
            + เพิ่มหมวด
          </Button>
          <Button
            className="rounded-full"
            disabled={busy || loading}
            onClick={() => void saveAll()}
          >
            บันทึกทั้งหมด
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

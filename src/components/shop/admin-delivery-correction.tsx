import { lazy, Suspense, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
const Editor = lazy(() => import("./admin-delivery-correction-editor"));
export function AdminDeliveryCorrection({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="mt-4">
          <Pencil className="size-4 text-[var(--icon-orange)]" aria-hidden="true" />
          แก้ไขข้อมูลที่ส่งแล้ว
        </Button>
      </DialogTrigger>
      <DialogContent
        title="แก้ไขข้อมูลสินค้าที่ส่งแล้ว"
        className="max-h-[85dvh] overflow-y-auto sm:w-[min(92vw,42rem)]"
      >
        {open ? (
          <Suspense fallback={<p role="status">กำลังเปิดเครื่องมือแก้ไข…</p>}>
            <Editor
              id={id}
              onBusy={setBusy}
              onSaved={() => {
                onSaved();
                setOpen(false);
              }}
            />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

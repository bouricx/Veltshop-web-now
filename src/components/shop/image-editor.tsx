import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/shop/media";
import { getSiteConfiguration } from "@/lib/shop/operations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
type Kind =
  "product" | "category" | "banner" | "logo" | "favicon" | "profile" | "announcement" | "icon";
export function ImageEditor({
  kind,
  value,
  onSaved,
}: {
  kind: Kind;
  value?: string;
  onSaved: (url: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [source, setSource] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [size, setSize] = useState({ width: 0, height: 0 }),
    [target, setTarget] = useState({ width: 800, height: 800 }),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0),
    [x, setX] = useState(0),
    [y, setY] = useState(0),
    [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    void getSiteConfiguration().then((c) =>
      setTarget(
        kind === "banner"
          ? { width: c.imageBannerWidth, height: c.imageBannerHeight }
          : kind === "logo"
            ? { width: 500, height: 150 }
            : { width: c.imageSquare, height: c.imageSquare },
      ),
    );
  }, [kind]);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !canvas.current) return;
      setSize({ width: image.width, height: image.height });
      const ctx = canvas.current.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.save();
      ctx.translate(target.width / 2 + x, target.height / 2 + y);
      ctx.rotate((rotation * Math.PI) / 180);
      const swapped = rotation % 180 !== 0;
      const scale =
        Math.max(
          target.width / (swapped ? image.height : image.width),
          target.height / (swapped ? image.width : image.height),
        ) * zoom;
      ctx.scale(scale, scale);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      ctx.restore();
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, target, zoom, rotation, x, y]);
  async function select(f: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024) {
      toast.error("รองรับ PNG/JPEG/WebP ไม่เกิน 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result));
      setFile(f);
      setZoom(1);
      setRotation(0);
      setX(0);
      setY(0);
    };
    reader.readAsDataURL(f);
  }
  async function save() {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const result = await uploadMedia({
        data: {
          kind,
          dataUrl: canvas.current.toDataURL("image/webp", 0.92),
          fileName: "edited.webp",
        },
      });
      onSaved(result.url);
      setOpen(false);
      setSource("");
      toast.success("บันทึกรูปแล้ว");
    } catch {
      toast.error("บันทึกรูปไม่สำเร็จ โปรดตรวจชนิดและขนาดรูป");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        ขนาดแนะนำ {target.width} × {target.height} px · PNG/JPEG/WebP
      </p>
      {value ? (
        <img src={value} alt="รูปปัจจุบัน" className="h-20 max-w-full rounded-lg object-contain" />
      ) : null}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        เลือกรูป / ครอป
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="ปรับรูปก่อนบันทึก" className="max-h-[90dvh] overflow-auto">
          <Label htmlFor={`file-${kind}`}>เลือกรูป</Label>
          <Input
            id={`file-${kind}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void select(f);
            }}
          />
          {source ? (
            <>
              <p className="text-xs">
                ต้นฉบับ {size.width} × {size.height} px · {file?.type} ·{" "}
                {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB · อัตราส่วน{" "}
                {(size.width / Math.max(1, size.height)).toFixed(2)}
              </p>
              <canvas
                ref={canvas}
                width={target.width}
                height={target.height}
                className="max-h-64 w-full rounded-lg bg-surface-2 object-contain"
              />
              <p className="text-xs">
                บันทึกเป็น {target.width} × {target.height} px พร้อมรูปขนาดย่อ
              </p>
              {[
                ["ซูม", zoom, setZoom, 1, 4],
                ["ตำแหน่งแนวนอน", x, setX, -target.width / 2, target.width / 2],
                ["ตำแหน่งแนวตั้ง", y, setY, -target.height / 2, target.height / 2],
              ].map(([label, v, set, min, max]) => (
                <label key={String(label)} className="block text-sm">
                  {String(label)}
                  <input
                    className="w-full"
                    type="range"
                    min={Number(min)}
                    max={Number(max)}
                    step={0.01}
                    value={Number(v)}
                    onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                  />
                </label>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                หมุน 90°
              </Button>
              <Button type="button" disabled={busy} onClick={() => void save()}>
                {busy ? "กำลังบันทึก…" : "ยืนยันรูป"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

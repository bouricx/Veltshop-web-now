import { imageTarget, allowedImageFormats } from "@/lib/shop/image-policy";
import { useEffect, useId, useRef, useState } from "react";
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
  const inputId = useId();
  const [formats, setFormats] = useState(["png", "jpeg", "webp"]);
  const [fit, setFit] = useState<"contain" | "cover">(
    kind === "banner" || kind === "profile" ? "cover" : "contain",
  );
  const [maxMb, setMaxMb] = useState(5);
  const [quality, setQuality] = useState(85);
  const [ready, setReady] = useState(false);
  const [currentSize, setCurrentSize] = useState({ width: 0, height: 0 });
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
    let active = true;
    void getSiteConfiguration()
      .then((c) => {
        if (!active) return;
        setMaxMb(c.imageMaxMb);
        setQuality(c.imageQuality);
        setFormats(allowedImageFormats(c));
        setTarget(imageTarget(kind, c));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind]);
  useEffect(() => {
    if (!source || !open) return;
    setReady(false);
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !canvas.current) return;
      setSize({ width: image.width, height: image.height });
      const ctx = canvas.current.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, target.width, target.height);
      if (kind === "product") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, target.width, target.height);
      }
      ctx.save();
      ctx.translate(target.width / 2 + x, target.height / 2 + y);
      ctx.rotate((rotation * Math.PI) / 180);
      const swapped = rotation % 180 !== 0;
      const scale =
        (fit === "cover" ? Math.max : Math.min)(
          target.width / (swapped ? image.height : image.width),
          target.height / (swapped ? image.width : image.height),
        ) * zoom;
      ctx.scale(scale, scale);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      ctx.restore();
      setReady(true);
    };
    image.onerror = () => {
      if (active) {
        setReady(false);
        toast.error("อ่านรูปไม่ได้ กรุณาเลือก PNG, JPEG หรือ WebP ที่ไม่เสียหาย");
      }
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, target, zoom, rotation, x, y, open, fit, kind]);
  async function select(f: File) {
    if (
      !formats.map((v) => `image/${v}`).includes(f.type) ||
      f.size > maxMb * 1024 * 1024 ||
      !/\.(png|jpe?g|webp)$/i.test(f.name)
    ) {
      toast.error(
        `รองรับ ${formats.join("/")} ไม่เกิน ${maxMb} MB (ไฟล์นี้ ${(f.size / 1024 / 1024).toFixed(2)} MB)`,
      );
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
    reader.onerror = () => toast.error("อ่านไฟล์ไม่สำเร็จ กรุณาเลือกใหม่");
    reader.readAsDataURL(f);
  }
  async function editCurrent() {
    if (!value) return;
    setBusy(true);
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin)
        throw new Error("กรุณาอัปโหลดต้นฉบับใหม่สำหรับรูปจากเว็บไซต์ภายนอก");
      const response = await fetch(url);
      if (!response.ok) throw new Error("โหลดรูปเดิมไม่สำเร็จ");
      const blob = await response.blob();
      const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
      await select(new File([blob], `current.${ext}`, { type: blob.type }));
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดรูปเดิมไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!canvas.current || !ready) return;
    setBusy(true);
    try {
      const format = formats.includes("webp") ? "webp" : formats.includes("png") ? "png" : "jpeg";
      const result = await uploadMedia({
        data: {
          kind,
          dataUrl: canvas.current.toDataURL(`image/${format}`, quality / 100),
          fileName: `edited.${format === "jpeg" ? "jpg" : format}`,
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
        ขนาดแนะนำ {target.width} × {target.height} px · PNG/JPEG/WebP · สูงสุด {maxMb} MB
      </p>
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-border p-3">
          <img
            src={value}
            alt="รูปปัจจุบัน"
            onLoad={(e) =>
              setCurrentSize({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            className="h-20 max-w-32 rounded-lg object-contain"
          />
          <div className="text-xs text-muted">
            รูปปัจจุบัน
            <p className="mt-1">
              {currentSize.width} × {currentSize.height} px
            </p>
            <p>อัตราส่วน {(currentSize.width / Math.max(1, currentSize.height)).toFixed(2)}</p>
          </div>
        </div>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        เลือกรูป / ครอป
      </Button>
      {value ? (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void editCurrent()}>
          แก้ไขรูปปัจจุบัน
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent title="ปรับรูปก่อนบันทึก" className="max-h-[90dvh] overflow-auto">
          <Label htmlFor={inputId}>เลือกรูป</Label>
          <Input
            id={inputId}
            type="file"
            accept={formats.map((v) => `image/${v}`).join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void select(f);
              e.target.value = "";
            }}
          />
          {source ? (
            <>
              <p className="text-xs">
                ต้นฉบับ {size.width} × {size.height} px · {file?.type} ·{" "}
                {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB · อัตราส่วน{" "}
                {(size.width / Math.max(1, size.height)).toFixed(2)}
              </p>
              <p className="rounded-lg bg-bg p-3 text-xs text-muted">
                {Math.abs(size.width / Math.max(1, size.height) - target.width / target.height) <
                0.02
                  ? "✓ อัตราส่วนเหมาะสม"
                  : "อัตราส่วนต่างจากขนาดแนะนำ เลื่อนและซูมเพื่อเลือกบริเวณที่ต้องการ"}{" "}
                · กรอบบันทึก {target.width}:{target.height}
              </p>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fit === "cover"}
                  onChange={(e) => setFit(e.target.checked ? "cover" : "contain")}
                />
                ครอปให้เต็มกรอบ (ปิดเพื่อแสดงภาพครบ)
              </label>
              <canvas
                ref={canvas}
                width={target.width}
                height={target.height}
                style={{ aspectRatio: `${target.width}/${target.height}` }}
                className="mx-auto max-h-64 max-w-full rounded-lg bg-surface-2 object-contain"
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setX(0);
                  setY(0);
                }}
              >
                คืนค่า
              </Button>
              <Button type="button" disabled={busy || !ready} onClick={() => void save()}>
                {busy ? "กำลังบันทึก…" : "ยืนยันรูป"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

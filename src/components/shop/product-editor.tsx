import { ImageEditor } from "./image-editor";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import {
  listCategories,
  saveProduct,
  uploadProductImage,
  type CategoryRow,
  type ProductInput,
} from "@/lib/shop/actions";
import type { Product } from "@/lib/shop/catalog";

const deliveries: Product["delivery"][] = [
  "account",
  "code",
  "otp",
  "smm",
  "topup",
  "email-password",
  "license",
  "text",
  "file",
  "link",
];
const presetImages = [
  "/images/cat-stream.jpg",
  "/images/cat-music.jpg",
  "/images/cat-game.jpg",
  "/images/cat-otp.jpg",
  "/images/cat-box.jpg",
];

export function ProductEditor({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product?: Product | null;
  onSaved: (p: Product) => void;
}) {
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [form, setForm] = useState<ProductInput>(blank());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void listCategories().then(setCats);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(product ? fromProduct(product) : blank(cats[0]?.id));
  }, [open, product, cats]);

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await uploadProductImage({ data: { dataUrl, fileName: file.name } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setForm((f) => ({ ...f, image: res.url }));
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ (ต้องเป็นแอดมิน)");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveProduct({ data: form });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onSaved(res.product);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ (ต้องเป็นแอดมิน)");
    } finally {
      setSaving(false);
    }
  }

  async function onSoftDelete() {
    if (!product?.id || !window.confirm("ยืนยันซ่อนสินค้านี้? ประวัติการซื้อจะยังอยู่")) return;
    setSaving(true);
    try {
      const { archiveProduct } = await import("@/lib/shop/actions");
      const res = await archiveProduct({ data: { id: product.id } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onSaved(res.product);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ซ่อนสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const imageOptions = uniqueImages(form.image, presetImages);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={product ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
        className="max-h-[85dvh] overflow-y-auto"
      >
        <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <Field label="ชื่อสินค้า">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="รายละเอียดสั้น">
            <Input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="หมวด">
              <NativeSelect
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="ส่งของ">
              <NativeSelect
                value={form.delivery}
                onChange={(e) =>
                  setForm({ ...form, delivery: e.target.value as Product["delivery"] })
                }
              >
                {deliveries.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="ราคา">
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="ราคาเดิม">
              <Input
                type="number"
                min={0}
                value={form.compareAt ?? ""}
                onChange={(e) =>
                  setForm({ ...form, compareAt: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="สต๊อก">
              <Input
                type="number"
                min={0}
                disabled={product?.stockMode === "individual"}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
              {product?.stockMode === "individual" ? (
                <p className="text-xs text-muted">
                  จำนวนคงเหลือคำนวณจากสต็อกจริง เพิ่มสินค้าได้ที่ปุ่มสต็อกจริง
                </p>
              ) : null}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="รับประกัน (วัน) 0 = ไม่มี">
              <Input
                type="number"
                min={0}
                max={3650}
                value={form.warrantyDays ?? 0}
                onChange={(e) => setForm({ ...form, warrantyDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="สีสินค้า">
              <Input
                type="color"
                value={form.cardColor ?? "#18181b"}
                onChange={(e) => setForm({ ...form, cardColor: e.target.value })}
              />
            </Field>
            <Field label="ป้ายสินค้า">
              <Input
                maxLength={80}
                value={form.badge ?? ""}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
              />
            </Field>
            <Field label="ลำดับ">
              <Input
                type="number"
                min={0}
                value={form.sortOrder ?? 0}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="รูปสินค้า">
            <ImageEditor
              kind="product"
              value={form.image}
              onSaved={(image) => setForm((f) => ({ ...f, image }))}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="overflow-hidden rounded-2xl bg-bg shadow-border">
                <img
                  src={form.image || "/images/cat-stream.jpg"}
                  alt=""
                  className="h-28 w-28 object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(f);
                      e.target.value = "";
                    }}
                  />
                  {uploading ? "กำลังอัปโหลด…" : "อัปโหลด / เปลี่ยนรูป"}
                </label>
                <NativeSelect
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                >
                  {imageOptions.map((src) => (
                    <option key={src} value={src}>
                      {src.startsWith("/uploads/")
                        ? `อัปโหลด · ${src.split("/").pop()}`
                        : src.replace("/images/", "")}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted">
                  อัปโหลดไฟล์ใหม่ หรือเลือกจากรูปเดิม · สูงสุด ~2.5MB
                </p>
              </div>
            </div>
          </Field>

          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active !== false}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 accent-current"
            />
            วางขาย
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="size-4 accent-current"
              />
              แนะนำ
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.flash)}
                onChange={(e) => setForm({ ...form, flash: e.target.checked })}
                className="size-4 accent-current"
              />
              Flash Sale
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {product ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-full"
                disabled={saving || uploading}
                onClick={() => void onSoftDelete()}
              >
                ซ่อนสินค้า
              </Button>
            ) : null}
            <Button type="submit" className="flex-1 rounded-full" disabled={saving || uploading}>
              {saving ? "กำลังบันทึก…" : "บันทึกสินค้า"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function blank(category = "stream"): ProductInput {
  return {
    name: "",
    subtitle: "",
    category,
    price: 99,
    stock: 0,
    image: "/images/cat-stream.jpg",
    delivery: "code",
    active: true,
  };
}

function fromProduct(p: Product): ProductInput {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    category: p.category,
    price: p.price,
    compareAt: p.compareAt,
    stock: p.stock,
    warrantyDays: p.warrantyDays,
    cardColor: p.cardColor,
    badge: p.badge,
    sortOrder: p.sortOrder,
    image: p.image,
    delivery: p.delivery,
    featured: p.featured,
    flash: p.flash,
    active: p.active !== false,
  };
}

function uniqueImages(current: string, presets: string[]) {
  const list = [...presets];
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

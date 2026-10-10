import { contrastText } from "@/lib/shop/presentation";
import { ImageEditor } from "./image-editor";
import {
  useEffect,
  useId,
  useState,
  Children,
  cloneElement,
  isValidElement,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import {
  listCategories,
  saveProduct,
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

  useEffect(() => {
    void listCategories()
      .then(setCats)
      .catch(() => toast.error("โหลดหมวดสินค้าไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(product ? fromProduct(product) : blank(cats[0]?.id));
  }, [open, product, cats]);

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
          <Field label="รายละเอียดสินค้า / คำค้น">
            <Textarea
              maxLength={10000}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="สิ่งที่ได้รับ วิธีใช้งาน และเงื่อนไขสินค้า"
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
                    {deliveryLabels[d]}
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
            <Field label="ไอคอนสินค้า (อีโมจิ)">
              <Input
                maxLength={20}
                value={form.icon ?? ""}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="เช่น 🎮"
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
          <fieldset className="rounded-2xl border border-border p-4 space-y-3">
            <legend className="px-2 text-sm font-medium">ธีมและสีประจำสินค้า</legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["cardColor", "สีหลักสินค้า"],
                  ["borderColor", "สีขอบ"],
                  ["accentColor", "สีปุ่ม / จุดเน้น"],
                  ["badgeColor", "สีป้าย"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="color"
                    value={form[key] ?? form.cardColor ?? "#18181b"}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="ชุดสีสินค้า">
              {["#18181b", "#dc2626", "#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777"].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`ใช้ชุดสี ${color}`}
                    className="size-9 rounded-full border-4 border-white shadow-border"
                    style={{ background: color }}
                    onClick={() =>
                      setForm({
                        ...form,
                        cardColor: color,
                        accentColor: color,
                        borderColor: color,
                        badgeColor: color,
                      })
                    }
                  />
                ),
              )}
            </div>
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: form.borderColor ?? form.cardColor,
                background: `${form.cardColor ?? "#18181b"}0d`,
              }}
            >
              <span className="text-xs text-muted">ตัวอย่างธีม</span>
              <p className="mt-1 font-semibold">
                {form.icon} {form.name || "ชื่อสินค้า"}
              </p>
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs"
                style={{
                  background: form.badgeColor ?? form.cardColor ?? "#18181b",
                  color: contrastText(form.badgeColor ?? form.cardColor ?? "#18181b"),
                }}
              >
                {form.badge || "ป้ายสินค้า"}
              </span>
            </div>
          </fieldset>
          <Field label="รูปสินค้า">
            <ImageEditor
              kind="product"
              value={form.image}
              onSaved={(image) => setForm((f) => ({ ...f, image }))}
            />
            <NativeSelect
              aria-label="เลือกรูปจากคลังเริ่มต้น"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            >
              {imageOptions.map((src) => (
                <option key={src} value={src}>
                  {src.startsWith("/images/") ? src.replace("/images/", "") : "รูปที่อัปโหลด"}
                </option>
              ))}
            </NativeSelect>
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
                disabled={saving}
                onClick={() => void onSoftDelete()}
              >
                ซ่อนสินค้า
              </Button>
            ) : null}
            <Button type="submit" className="flex-1 rounded-full" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกสินค้า"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const controls = Children.toArray(children);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {controls.map((child, i) =>
        i === 0 && isValidElement<{ id?: string }>(child) && child.type !== ImageEditor
          ? cloneElement(child, { id })
          : child,
      )}
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
    borderColor: p.borderColor,
    accentColor: p.accentColor,
    badgeColor: p.badgeColor,
    description: p.description,
    icon: p.icon,
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

const deliveryLabels: Record<Product["delivery"], string> = {
  account: "บัญชี",
  code: "โค้ด",
  otp: "OTP",
  smm: "บริการโซเชียล",
  topup: "เติมเกม",
  "email-password": "อีเมล + รหัสผ่าน",
  license: "License Key",
  text: "ข้อความ",
  file: "ไฟล์ดาวน์โหลด",
  link: "ลิงก์",
};

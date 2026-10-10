import { useState } from "react";
import { toast } from "sonner";
import { importShopData } from "@/lib/shop/imports";
import { Button } from "@/components/ui/button";
export function DataImport({ kind, onSaved }: { kind: "products" | "gifts"; onSaved: () => void }) {
  const [rows, setRows] = useState<unknown[]>([]),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        นำเข้า{kind === "products" ? "สินค้า" : "โค้ดของขวัญ"}จากไฟล์
      </summary>
      <p className="mt-2 text-xs text-muted">
        ไฟล์ JSON แบบรายการ สูงสุด 200 รายการ / 2 MB ระบบตรวจข้อมูลก่อนบันทึก
        และยกเลิกทั้งชุดเมื่อมีรายการผิดหรือรหัสซ้ำ
      </p>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={() => {
          const example =
            kind === "products"
              ? [
                  {
                    name: "",
                    subtitle: "",
                    category: "",
                    price: 0,
                    stock: 0,
                    image: "",
                    delivery: "code",
                    active: false,
                  },
                ]
              : [
                  {
                    code: "",
                    label: "",
                    reward: "credit",
                    amount: 0,
                    productId: null,
                    usageLimit: 1,
                    expiresAt: null,
                    active: false,
                  },
                ];
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(example, null, 2)], { type: "application/json" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = `${kind}-template.json`;
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        ดาวน์โหลดแบบฟอร์ม
      </Button>
      <p className="mt-2 text-xs text-muted">
        เติมข้อมูลในแบบฟอร์มก่อนนำเข้า สินค้าต้องระบุรหัสหมวดที่มีอยู่แล้ว
        โค้ดของขวัญต้องยาวอย่างน้อย 16 ตัวอักษร
      </p>
      <input
        aria-label="ไฟล์นำเข้า"
        className="mt-3 block max-w-full text-sm"
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            setError("ไฟล์ใหญ่เกิน 2 MB");
            return;
          }
          void file
            .text()
            .then((text) => {
              const data = JSON.parse(text);
              if (!Array.isArray(data) || !data.length || data.length > 200) throw Error();
              setRows(data);
              setKey(crypto.randomUUID());
              setError("");
            })
            .catch(() => {
              setRows([]);
              setError("รูปแบบไฟล์ไม่ถูกต้อง");
            });
        }}
      />
      {rows.length ? (
        <div className="mt-3">
          <p className="text-sm">เลือกแล้ว {rows.length} รายการ</p>
          <Button
            className="mt-2"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void importShopData({ data: { kind, rows, key } })
                .then((r) => {
                  if (r.ok) {
                    toast.success(`นำเข้า ${r.result.count} รายการแล้ว`);
                    setRows([]);
                    setError("");
                    onSaved();
                  } else setError(r.message);
                })
                .catch(() => setError("นำเข้าไม่สำเร็จ ลองยืนยันซ้ำได้โดยไม่เลือกไฟล์ใหม่"))
                .finally(() => setBusy(false));
            }}
          >
            ยืนยันนำเข้า
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </details>
  );
}

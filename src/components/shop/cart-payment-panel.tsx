import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, QrCode, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCartPaymentInfo, submitCartPaymentSlip } from "@/lib/shop/cart-requests";
import { promptPayQrDataUrl } from "@/lib/shop/promptpay-qr";
import { formatBaht } from "@/lib/utils";

type PaymentInfo = {
  amount: number;
  status: string;
  receive_account: string;
  receive_name: string;
};

export function CartPaymentPanel({
  id,
  paymentStatus,
  paymentReason,
}: {
  id: string;
  paymentStatus: string;
  paymentReason?: string | null;
}) {
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [qr, setQr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState(paymentStatus);
  const [currentReason, setCurrentReason] = useState(paymentReason || "");

  useEffect(() => {
    let active = true;
    void getCartPaymentInfo({ data: { id } }).then(async (result) => {
      if (!active || !result) return;
      setInfo(result);
      try {
        const dataUrl = await promptPayQrDataUrl(result.receive_account, result.amount);
        if (active) setQr(dataUrl);
      } catch {
        if (active) setError("สร้าง QR ไม่สำเร็จ กรุณาติดต่อร้าน");
      }
    }).catch(() => {
      if (active) setError("โหลดรายละเอียดชำระเงินไม่สำเร็จ กรุณาลองใหม่");
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function uploadSlip() {
    if (!file || busy || paymentStatus === "paid") return;
    if (file.size > 5 * 1024 * 1024) {
      setError("ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("รองรับไฟล์ PNG, JPG หรือ WebP เท่านั้น");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
        reader.onload = () =>
          typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("ไฟล์ไม่ถูกต้อง"));
        reader.readAsDataURL(file);
      });
      const result = await submitCartPaymentSlip({ data: { id, slipDataUrl: dataUrl, mime: file.type as "image/png" | "image/jpeg" | "image/webp" } });
      if (result.ok) {
        setMessage(result.message);
        setCurrentStatus("paid");
      } else {
        if ("status" in result && result.status) setCurrentStatus(result.status);
        setCurrentReason(result.message);
        setError(result.message);
      }
    } catch {
      setError("ส่งสลิปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <p className="mt-4 text-sm text-muted">กำลังโหลด QR ชำระเงิน…</p>;
  if (currentStatus === "paid")
    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">ตรวจสลิปและยืนยันชำระแล้ว</p>
          <p className="mt-1 text-sm">ร้านจะตรวจรายการและดำเนินการจัดส่ง โดยปกติใช้เวลา 5–10 นาที</p>
        </div>
      </div>
    );

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <QrCode className="size-4" aria-hidden="true" />
        ชำระด้วย QR พร้อมเพย์
      </div>
      <p className="mt-2 text-sm">ยอดชำระ {formatBaht(info.amount)}</p>
      <p className="mt-1 text-xs text-muted">บัญชี {info.receive_name} · {info.receive_account}</p>
      {qr ? <img src={qr} alt={`QR พร้อมเพย์ ยอด ${info.amount} บาท`} className="mx-auto mt-4 size-56 rounded-xl bg-white p-2" /> : null}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-muted">
        <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>โอนตามยอดที่แสดง แล้วแนบสลิปจริง ระบบจะตรวจยอด ผู้รับเงิน และเลขอ้างอิงก่อนยืนยัน</p>
      </div>
      {currentStatus === "manual_review" ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {currentReason || "รับสลิปแล้ว แต่ยังตรวจอัตโนมัติไม่ได้"} กรุณาติดต่อร้านเพื่อให้แอดมินตรวจ
        </p>
      ) : null}
      {currentReason && currentStatus === "rejected" && !error ? (
        <p className="mt-3 text-sm text-danger">ตรวจไม่ผ่าน: {currentReason}</p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      <label className="mt-4 block text-sm font-medium" htmlFor={`slip-${id}`}>แนบสลิปโอนเงิน</label>
      <input
        id={`slip-${id}`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2"
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0] ?? null);
          setError("");
        }}
        disabled={busy}
      />
      <p className="mt-1 text-xs text-muted">ไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB</p>
      <Button type="button" className="mt-4 w-full" onClick={() => void uploadSlip()} disabled={!file || busy}>
        <Upload className="size-4" aria-hidden="true" />
        {busy ? "กำลังตรวจสอบสลิป…" : currentStatus === "verifying" ? "แนบสลิปเพื่อตรวจอีกครั้ง" : "ส่งสลิปให้ระบบตรวจ"}
      </Button>
    </div>
  );
}

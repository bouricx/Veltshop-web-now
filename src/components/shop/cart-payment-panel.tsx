import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Loader2,
  QrCode,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCartPaymentInfo, submitCartPaymentSlip } from "@/lib/shop/cart-requests";
import { promptPayQrDataUrl } from "@/lib/shop/promptpay-qr";
import { MAX_SLIP_BYTES } from "@/lib/shop/payment-policy";
import { formatBaht } from "@/lib/utils";

type PaymentInfo = NonNullable<Awaited<ReturnType<typeof getCartPaymentInfo>>>;
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
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const serverOffset = useRef(0),
    submitting = useRef(false),
    loadVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const version = loadVersion.current;
      try {
        const result = await getCartPaymentInfo({ data: { id } });
        if (!active || submitting.current || version !== loadVersion.current) return;
        if (!result) {
          setError("ไม่พบรายการชำระเงิน กรุณาใช้บัญชีที่สั่งซื้อ");
          return;
        }
        serverOffset.current = result.server_time - Date.now();
        setNow(result.server_time);
        setInfo(result);
      } catch {
        if (active && !submitting.current && version === loadVersion.current)
          setError("โหลดสถานะไม่สำเร็จ กดโหลดใหม่ก่อนโอนเงิน");
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !submitting.current) void load();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, paymentStatus, paymentReason, reload]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + serverOffset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const status = info?.status ?? paymentStatus;
  const remaining = info ? Math.max(0, Math.ceil((Date.parse(info.expires_at) - now) / 1000)) : 0;
  const expired =
    status === "expired" || (remaining === 0 && ["unpaid", "rejected"].includes(status));
  const cancelled = info?.order_status === "cancelled";
  const canPay = Boolean(
    info?.available && !expired && !cancelled && ["unpaid", "rejected"].includes(status),
  );
  const account = info?.receive_account,
    amount = info?.amount;
  useEffect(() => {
    let active = true;
    setQr("");
    if (canPay && account && amount)
      void promptPayQrDataUrl(account, amount)
        .then((value) => {
          if (active) setQr(value);
        })
        .catch(() => {
          if (active) setError("สร้าง QR ไม่สำเร็จ กรุณาติดต่อร้านก่อนโอน");
        });
    return () => {
      active = false;
    };
  }, [canPay, account, amount]);
  async function uploadSlip() {
    if (
      !file ||
      submitting.current ||
      cancelled ||
      !["unpaid", "rejected", "expired"].includes(status)
    )
      return;
    submitting.current = true;
    loadVersion.current += 1;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("ไฟล์ไม่ถูกต้อง"));
        reader.readAsDataURL(file);
      });
      const result = await submitCartPaymentSlip({
        data: {
          id,
          slipDataUrl: dataUrl,
          mime: file.type as "image/png" | "image/jpeg" | "image/webp",
        },
      });
      if (result.ok || ("pending" in result && result.pending)) {
        setMessage(result.message);
        setFile(null);
      } else setError(result.message);
      if ("status" in result && result.status)
        setInfo((previous) =>
          previous ? { ...previous, status: result.status as PaymentInfo["status"] } : previous,
        );
    } catch {
      setError("ยังยืนยันผลการส่งไม่ได้ กรุณาโหลดสถานะก่อนส่งซ้ำ และอย่าโอนเงินซ้ำ");
    } finally {
      submitting.current = false;
      setBusy(false);
      setReload((value) => value + 1);
    }
  }
  const refresh = (
    <Button
      type="button"
      variant="outline"
      className="mt-3"
      onClick={() => {
        setError("");
        setReload((n) => n + 1);
      }}
    >
      <RefreshCw className="size-4" aria-hidden="true" />
      โหลดสถานะใหม่
    </Button>
  );
  if (!info)
    return (
      <div className="mt-4 text-sm" aria-live="polite">
        {error ? (
          <>
            <p role="alert" className="text-danger">
              {error}
            </p>
            {refresh}
          </>
        ) : (
          <p className="text-muted">กำลังโหลดรายละเอียดชำระเงิน…</p>
        )}
      </div>
    );
  if (cancelled)
    return (
      <p className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
        รายการถูกยกเลิกแล้ว กรุณาอย่าโอนเงินเข้ารายการนี้
      </p>
    );
  if (["paid", "manual_review", "verifying"].includes(status))
    return (
      <div
        role="status"
        className={`mt-4 rounded-xl border p-4 ${status === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}
      >
        <div className="flex items-start gap-3">
          {status === "paid" ? (
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          ) : (
            <Clock3 className="size-5 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold">
              {status === "paid"
                ? "ยืนยันได้รับเงินแล้ว"
                : status === "manual_review"
                  ? "รับสลิปแล้ว · รอแอดมินตรวจยอดเงิน"
                  : "กำลังตรวจสอบสลิป"}
            </p>
            <p className="mt-1 text-sm">
              {status === "paid"
                ? info.order_status === "done"
                  ? "ร้านจัดส่งรายการนี้เรียบร้อยแล้ว"
                  : "ร้านจะดำเนินการจัดส่ง โดยปกติ 5–10 นาทีหลังยืนยัน"
                : "ไม่ต้องโอนหรือส่งสลิปซ้ำ สถานะจะอัปเดตอัตโนมัติ"}
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm">
            {error}
          </p>
        ) : null}
        {status !== "paid" || error ? refresh : null}
      </div>
    );
  return (
    <section
      aria-label="รายละเอียดการชำระเงิน"
      className="mt-5 min-w-0 rounded-2xl border border-border bg-surface p-4 text-text sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <QrCode className="size-5" aria-hidden="true" />
          ชำระด้วยพร้อมเพย์
        </h3>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium">
          {info.verification === "manual" ? "แอดมินตรวจสลิป" : "ตรวจสลิปอัตโนมัติ"}
        </span>
      </div>
      <p className="mt-4 text-xs text-muted">ยอดที่ต้องชำระ</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{formatBaht(info.amount)}</p>
      {expired ? (
        <div role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">หมดเวลาชำระเงินแล้ว · กรุณาอย่าโอนเพิ่ม</p>
          <p className="mt-1">
            หากโอนไปแล้ว ให้แนบสลิปด้านล่างเพื่อให้แอดมินตรวจ หากยังไม่ได้โอน
            ให้เลือกสินค้าและสร้างรายการใหม่
          </p>
        </div>
      ) : !info.available ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{info.message}</p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="min-w-0 text-center">
            {qr ? (
              <img
                src={qr}
                alt={`QR พร้อมเพย์ ยอด ${info.amount} บาท`}
                width={224}
                height={224}
                className="mx-auto aspect-square w-full max-w-56 rounded-xl border border-border bg-white p-2"
              />
            ) : (
              <p className="p-8 text-sm text-muted">กำลังเตรียม QR…</p>
            )}
            {qr ? (
              <a
                href={qr}
                download={`Veltshop-${id.slice(0, 8)}.png`}
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"
              >
                <Download className="size-4" aria-hidden="true" />
                บันทึก QR ลงเครื่อง
              </a>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">บัญชีรับเงิน</p>
            <p className="mt-1 break-words font-semibold">{info.receive_name}</p>
            <p className="mt-1 break-all text-sm tabular-nums">{info.receive_account}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() =>
                void navigator.clipboard
                  .writeText(info.receive_account)
                  .then(() => setMessage("คัดลอกเลขพร้อมเพย์แล้ว"))
                  .catch(() => setError("คัดลอกไม่ได้ กรุณาใช้เลขที่แสดงด้านบน"))
              }
            >
              <Copy className="size-4" aria-hidden="true" />
              คัดลอกเลขพร้อมเพย์
            </Button>
            <div
              className={`mt-4 rounded-xl p-3 ${remaining <= 60 ? "bg-amber-50 text-amber-950" : "bg-surface-2"}`}
            >
              <p className="text-xs">เวลาชำระเงินที่เหลือ</p>
              <p role="timer" aria-live="off" className="mt-1 text-2xl font-semibold tabular-nums">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              ตรวจชื่อผู้รับและยอดในแอปธนาคารก่อนโอน QR ที่บันทึกไว้อาจยังสแกนได้หลังหมดเวลา
              กรุณาอย่าโอนหลังหมดเวลา
            </p>
          </div>
        </div>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-sm font-semibold">
          {expired ? "โอนแล้ว? แนบสลิปให้แอดมินตรวจ" : "โอนแล้ว แนบสลิปที่นี่"}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {info.verification === "manual" || expired
            ? "แอดมินจะตรวจยอดเข้าบัญชีจริงก่อนยืนยันคำสั่งซื้อ"
            : "ตรวจยอด ผู้รับเงิน เวลาโอน และสลิปซ้ำก่อนยืนยัน"}
        </p>
        {status === "rejected" && (info.reject_reason || paymentReason) ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {info.reject_reason || paymentReason}
          </p>
        ) : null}
        <label htmlFor={`slip-${id}`} className="mt-4 block text-sm font-medium">
          เลือกภาพสลิปจากแอปธนาคาร
        </label>
        <input
          id={`slip-${id}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          className="mt-2 block w-full min-w-0 text-xs file:mr-2 file:rounded-xl file:border-0 file:bg-surface-2 file:px-3 file:py-3 file:text-sm"
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null;
            setError("");
            setMessage("");
            if (
              selected &&
              (selected.size > MAX_SLIP_BYTES ||
                !["image/png", "image/jpeg", "image/webp"].includes(selected.type))
            ) {
              setError("กรุณาใช้ภาพ PNG, JPG หรือ WebP ขนาดไม่เกิน 3 MB");
              setFile(null);
              event.currentTarget.value = "";
            } else setFile(selected);
          }}
        />
        <p className="mt-2 text-xs text-muted">
          PNG, JPG หรือ WebP ไม่เกิน 3 MB · ภาพต้องเห็น QR บนสลิปครบ
        </p>
        {preview && file ? (
          <div className="mt-3 flex min-w-0 items-center gap-3 rounded-xl bg-surface-2 p-3">
            <img
              src={preview}
              alt="ภาพสลิปที่เลือก ยังไม่ได้ยืนยันชำระ"
              className="h-20 w-16 shrink-0 rounded-lg object-contain"
            />
            <p className="min-w-0 break-all text-xs">
              {file.name}
              <span className="mt-1 block text-muted">ตรวจภาพแล้วกดส่งสลิปด้านล่าง</span>
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-4 min-h-12 w-full"
          disabled={!file || busy}
          onClick={() => void uploadSlip()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {busy
            ? "กำลังส่งสลิป…"
            : expired || info.verification === "manual"
              ? "ส่งสลิปให้แอดมินตรวจ"
              : "ส่งสลิปและตรวจสอบการโอน"}
        </Button>
      </div>
    </section>
  );
}

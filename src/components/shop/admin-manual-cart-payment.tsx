import { useEffect, useState } from "react";
import { CheckCircle2, Eye, XCircle, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminCartPaymentReview, resolveManualCartPayment } from "@/lib/shop/cart-requests";
import { formatBaht } from "@/lib/utils";

export function AdminManualCartPayment({
  id,
  paymentStatus,
  onResolved,
}: {
  id: string;
  paymentStatus: string;
  onResolved: () => void;
}) {
  const [review, setReview] = useState<Awaited<
    ReturnType<typeof getAdminCartPaymentReview>
  > | null>(null);
  const [open, setOpen] = useState(paymentStatus === "manual_review");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [bankChecked, setBankChecked] = useState(false);

  useEffect(() => {
    setBankChecked(false);
    if (!open) return;
    let active = true;
    void getAdminCartPaymentReview({ data: { id } })
      .then((value) => {
        if (active) setReview(value);
      })
      .catch(() => {
        if (active) setMessage("โหลดไฟล์สลิปไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [id, open, paymentStatus]);
  const evidence = review?.slip_evidence;

  async function resolve(decision: "approve" | "reject") {
    if (busy || (decision === "approve" && !bankChecked)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await resolveManualCartPayment({
        data: {
          id,
          decision,
          reference,
          reason,
          expectedStatus: paymentStatus as "unpaid" | "rejected" | "expired" | "manual_review",
          bankConfirmed: bankChecked,
        },
      });
      setMessage(result.message);
      if (result.ok) onResolved();
    } catch {
      setMessage("บันทึกผลตรวจไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <Button
        type="button"
        variant="outline"
        className="mt-4 text-fg"
        onClick={() => setOpen(true)}
      >
        <WalletCards className="size-4" aria-hidden="true" />
        ตรวจยอดเงินเข้า / ยืนยันรับเงิน
      </Button>
    );
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-amber-950">
        <WalletCards className="size-5" aria-hidden="true" />
        ตรวจยอดเงินเข้าด้วยตนเอง
      </p>
      <p className="text-sm text-amber-900">
        ตรวจยอด ผู้รับเงิน และรายการโอนจริงในบัญชีธนาคารก่อนอนุมัติ
      </p>
      {review ? (
        <p className="rounded-xl bg-white p-3 text-sm text-amber-950">
          ยอดที่ต้องได้รับ <strong>{formatBaht(review.amount)}</strong>
          <br />
          ผู้รับ: {review.receive_name} · {review.receive_account}
        </p>
      ) : (
        <p className="text-sm text-amber-900">กำลังโหลดรายละเอียดบัญชีรับเงิน…</p>
      )}
      {paymentStatus === "expired" ? (
        <p className="text-xs leading-relaxed text-amber-900">
          ออเดอร์หมดเวลาแล้ว หากตรวจพบเงินเข้าจริงตามรายการ
          สามารถยืนยันรับเงินและจัดเตรียมสินค้าให้ลูกค้าได้
        </p>
      ) : null}
      {evidence ? (
        <Button
          type="button"
          variant="outline"
          aria-expanded={showEvidence}
          onClick={() => setShowEvidence((value) => !value)}
        >
          <Eye className="size-4" aria-hidden="true" /> ดูภาพสลิป
        </Button>
      ) : null}
      {showEvidence && evidence ? (
        <img
          src={evidence}
          alt="หลักฐานการโอนสำหรับแอดมินตรวจสอบ"
          className="max-h-[36rem] w-full max-w-lg rounded-xl border border-amber-200 bg-white object-contain"
        />
      ) : null}
      <div>
        <label htmlFor={`manual-reference-${id}`} className="text-sm font-medium">
          เลขอ้างอิงจากรายการธนาคาร
        </label>
        <Input
          id={`manual-reference-${id}`}
          className="mt-1"
          value={reference}
          onChange={(event) => setReference(event.currentTarget.value)}
          maxLength={200}
          disabled={busy}
          placeholder="กรอกเลขอ้างอิงก่อนอนุมัติ"
        />
      </div>
      <div>
        <label htmlFor={`manual-reason-${id}`} className="text-sm font-medium">
          เหตุผลเมื่อปฏิเสธ (ไม่บังคับ)
        </label>
        <Input
          id={`manual-reason-${id}`}
          className="mt-1"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          maxLength={300}
          disabled={busy}
          placeholder="เช่น ยอดไม่ตรง หรือปลายทางไม่ถูกต้อง"
        />
      </div>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <label className="flex min-h-11 items-start gap-2 text-sm text-amber-950">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={bankChecked}
          disabled={busy}
          onChange={(event) => setBankChecked(event.currentTarget.checked)}
        />
        <span>ตรวจยอดเงินเข้า บัญชีผู้รับ และเลขอ้างอิงจากรายการธนาคารจริงแล้ว</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !review || !bankChecked || reference.trim().length < 4}
          className="bg-[#111111] text-white hover:bg-[#27272a]"
          onClick={() => void resolve("approve")}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" /> ยืนยันว่าได้รับเงินแล้ว
        </Button>
        {paymentStatus === "manual_review" ? (
          <Button variant="outline" disabled={busy} onClick={() => void resolve("reject")}>
            <XCircle className="size-4" aria-hidden="true" /> ปฏิเสธสลิป
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="text-amber-950"
          onClick={() => setOpen(false)}
        >
          ปิดการตรวจยอด
        </Button>
      </div>
    </div>
  );
}

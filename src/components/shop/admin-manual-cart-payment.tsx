import { useEffect, useState } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCartPaymentEvidence, resolveManualCartPayment } from "@/lib/shop/cart-requests";

export function AdminManualCartPayment({ id }: { id: string }) {
  const [evidence, setEvidence] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [bankChecked, setBankChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void getCartPaymentEvidence({ data: { id } })
      .then((value) => {
        if (active) setEvidence(value);
      })
      .catch(() => {
        if (active) setMessage("โหลดไฟล์สลิปไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function resolve(decision: "approve" | "reject") {
    if (busy || (decision === "approve" && !bankChecked)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await resolveManualCartPayment({ data: { id, decision, reference, reason } });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    } catch {
      setMessage("บันทึกผลตรวจไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-semibold text-amber-950">ตรวจสลิปด้วยตนเอง</p>
      <p className="text-sm text-amber-900">
        ตรวจยอด ผู้รับเงิน และรายการโอนจริงในบัญชีธนาคารก่อนอนุมัติ
      </p>
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
          disabled={busy || !bankChecked || reference.trim().length < 4}
          onClick={() => void resolve("approve")}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" /> ยืนยันว่าได้รับเงินแล้ว
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void resolve("reject")}>
          <XCircle className="size-4" aria-hidden="true" /> ปฏิเสธสลิป
        </Button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportMyData,
  requestMyDeletion,
  listPrivacyRequests,
  reviewPrivacyRequest,
  type PrivacyRequest,
} from "@/lib/shop/privacy";
export function PrivacyControls() {
  const [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h2 className="font-medium">จัดการข้อมูลส่วนตัว</h2>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void exportMyData()
            .then((value) => {
              const url = URL.createObjectURL(
                new Blob([value.encoded], { type: "application/json" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "veltshop-my-data.json";
              a.click();
              URL.revokeObjectURL(url);
            })
            .catch(() => toast.error("ดาวน์โหลดข้อมูลไม่สำเร็จ"))
            .finally(() => setBusy(false));
        }}
      >
        ดาวน์โหลดข้อมูลของฉัน
      </Button>
      <p className="text-sm text-muted">
        ขอปิดบัญชีและลบข้อมูลระบุตัวตนได้หลังจัดการเครดิตและรายการค้าง
        ข้อมูลธุรกรรมและหลักฐานที่จำเป็นจะยังเก็บไว้
      </p>
      <Input
        aria-label="เหตุผลขอปิดบัญชี"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={2000}
        placeholder="เหตุผลขอปิดบัญชี"
      />
      <Button
        variant="secondary"
        disabled={busy || reason.trim().length < 3}
        onClick={() => {
          if (!window.confirm("ส่งคำขอปิดบัญชีให้ทีมงานตรวจสอบ?")) return;
          setBusy(true);
          void requestMyDeletion({ data: { reason, confirmed: true } })
            .then(() => {
              toast.success("ส่งคำขอแล้ว ทีมงานจะตรวจสอบ");
              setReason("");
            })
            .catch(() => toast.error("ส่งคำขอไม่สำเร็จ"))
            .finally(() => setBusy(false));
        }}
      >
        ขอปิดบัญชี
      </Button>
    </section>
  );
}
export function PrivacyRequestsPanel() {
  const [rows, setRows] = useState<PrivacyRequest[]>([]),
    [busy, setBusy] = useState(false);
  const load = () =>
    void listPrivacyRequests()
      .then(setRows)
      .catch(() => toast.error("โหลดคำขอไม่สำเร็จ"));
  useEffect(load, []);
  const review = (id: string, approve: boolean) => {
    const reply = window.prompt("ระบุเหตุผล/ผลการตรวจสอบ (อย่างน้อย 3 ตัวอักษร)");
    if (!reply || reply.trim().length < 3) return;
    if (
      !window.confirm(
        approve
          ? "ยืนยันปิดบัญชี ลบข้อมูลระบุตัวตนและช่องทางเข้าสู่ระบบ? ประวัติการเงินจะถูกเก็บไว้"
          : "ยืนยันไม่อนุมัติคำขอนี้?",
      )
    )
      return;
    setBusy(true);
    void reviewPrivacyRequest({ data: { id, approve, reply } })
      .then(() => {
        toast.success("บันทึกผลแล้ว");
        load();
      })
      .catch(() => toast.error("ทำรายการไม่ได้ ตรวจสิทธิ์แอดมิน เครดิตคงเหลือ และรายการค้าง"))
      .finally(() => setBusy(false));
  };
  return (
    <section className="space-y-3">
      <h2 className="font-medium">คำขอปิดบัญชีและข้อมูลส่วนตัว</h2>
      <p className="text-sm text-muted">
        เก็บประวัติการเงินและการตรวจสอบ แยกจากข้อมูลระบุตัวตน
        ห้ามอนุมัติบัญชีแอดมินหรือบัญชีที่มีเครดิต/รายการค้าง
      </p>
      {!rows.length ? (
        <p>ยังไม่มีคำขอ</p>
      ) : (
        rows.map((r) => (
          <article key={r.id} className="rounded-xl border border-border p-4 space-y-2">
            <p className="break-all">
              {r.name} · {r.email}
            </p>
            <p>
              {r.reason} · {r.status}
            </p>
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => review(r.id, true)}>
                  อนุมัติปิดบัญชี
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => review(r.id, false)}>
                  ไม่อนุมัติ
                </Button>
              </div>
            ) : (
              <p>{r.reply}</p>
            )}
          </article>
        ))
      )}
    </section>
  );
}

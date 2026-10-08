import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getShopSettings, topupWithSlip, type ShopSettings } from "@/lib/shop/actions";
import { promptPayQrDataUrl } from "@/lib/shop/promptpay-qr";
import { useShop } from "@/lib/shop/store";
import { cn, formatBaht } from "@/lib/utils";

export const Route = createFileRoute("/shop/topup")({ component: TopupPage });

const presets = [50, 100, 300, 500, 1000];

function TopupPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">กระเป๋าเงิน</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">เติมเงินอัตโนมัติ</h1>
      <p className="mt-2 text-sm text-muted">
        สแกน QR พร้อมเพย์หรือโอนแล้วอัปโหลดสลิป — ระบบตรวจที่บริการกลางก่อนเติมเครดิต (ไม่ผ่าน = ไม่เติม)
      </p>
      <div className="mt-8">
        <EmptyGate>
          <TopupForm />
        </EmptyGate>
      </div>
    </div>
  );
}


function TopupForm() {
  const topup = useShop((s) => s.topup);
  const balance = useShop((s) => s.balance);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [amount, setAmount] = useState(100);
  const [tab, setTab] = useState<"qr" | "wallet" | "slip">("qr");
  const [paymentMethod, setPaymentMethod] = useState<"promptpay" | "truewallet">("promptpay");
  const [checking, setChecking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    credit: number;
    fee: number;
    paymentId: string;
    message: string;
    note?: string;
  } | null>(null);
  const [reviewReceipt, setReviewReceipt] = useState<{
    paymentId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    void getShopSettings().then(setSettings);
  }, []);

  const promptpay = settings?.receive_account || "0928160016";
  const fee = settings?.wallet_fee ?? 3;

  useEffect(() => {
    let cancelled = false;
    setQrUrl(null);
    setQrError(null);
    void promptPayQrDataUrl(promptpay, amount)
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setQrError(err instanceof Error ? err.message : "สร้าง QR ไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [promptpay, amount]);


  async function onSlip(file: File) {
    setFileName(file.name);
    setChecking(true);
    try {
      const slipDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });
      // One server call: verify on :8787 + credit (server re-verifies; no client trust flags).
      const pay = await topupWithSlip({
        data: {
          amount,
          method: paymentMethod,
          slipDataUrl,
          fileName: file.name,
        },
      });
      if (!pay.ok) {
        if ("pending" in pay && pay.pending && pay.paymentId) {
          setReviewReceipt({ paymentId: pay.paymentId, message: pay.message });
          toast.message(pay.message);
        } else {
          toast.error(pay.message);
        }
        return;
      }
      const local = topup(pay.credit, "slip", pay.note, pay.paymentId);
      if (local.ok) {
        toast.success(pay.message);
        setReceipt({
          credit: pay.credit,
          fee: pay.fee,
          paymentId: pay.paymentId,
          message: pay.message,
          note: pay.note,
        });
      } else toast.error(local.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ตรวจสลิปไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(promptpay);
      toast.success("คัดลอกเลขพร้อมเพย์แล้ว");
    } catch {
      toast.message(promptpay);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-accent px-5 py-4 text-accent-fg">
        <p className="text-xs opacity-80">ยอดคงเหลือ</p>
        <p className="tabular text-3xl font-semibold">{formatBaht(balance)}</p>
      </div>

      {receipt ? (
        <div className="rounded-3xl bg-surface p-5 shadow-border">
          <p className="text-sm font-medium text-ok">เติมเงินสำเร็จ</p>
          <p className="mt-1 text-sm text-muted">{receipt.message}</p>
          <p className="mt-2 font-mono text-xs text-subtle">รหัส {receipt.paymentId}</p>
          {receipt.note ? <p className="mt-1 text-xs text-muted">{receipt.note}</p> : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-3 rounded-full"
            onClick={() => setReceipt(null)}
          >
            เติมอีกครั้ง
          </Button>
        </div>
      ) : null}

      {reviewReceipt ? (
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-border">
          <p className="text-sm font-medium text-warning">รับสลิปแล้ว · รอตรวจสอบ</p>
          <p className="mt-1 text-sm text-muted">{reviewReceipt.message}</p>
          <p className="mt-2 font-mono text-xs text-subtle">รหัส {reviewReceipt.paymentId}</p>
          <p className="mt-2 text-xs text-muted">ยอดจะไม่เข้ากระเป๋าจนกว่าระบบหรือแอดมินจะตรวจสอบเสร็จ</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["qr", "พร้อมเพย์ QR"],
            ["wallet", "True Wallet"],
            ["slip", "อัปโหลดสลิป"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm",
              tab === id ? "bg-accent text-accent-fg" : "bg-surface shadow-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-surface p-5 shadow-border">
        <Label htmlFor="amt">จำนวนเงิน</Label>
        <Input
          id="amt"
          className="mt-2 tabular"
          type="number"
          min={20}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={cn(
                "min-h-9 rounded-full px-3 text-sm",
                amount === p ? "bg-accent text-accent-fg" : "bg-bg shadow-border",
              )}
            >
              {formatBaht(p)}
            </button>
          ))}
        </div>
        {amount > 0 && amount < 20 ? (
          <p className="mt-2 text-xs text-danger">ยอดขั้นต่ำ ฿20</p>
        ) : null}
      </div>

      {tab === "qr" ? (
        <div className="space-y-6">
          <div className="space-y-3 rounded-3xl bg-surface p-5 shadow-border">
            <p className="font-medium">โอนพร้อมเพย์</p>
            <p className="text-sm text-muted">
              สแกน QR หรือโอนไป {promptpay} ({settings?.receive_name ?? "VELTSHOP"}) ยอด{" "}
              {formatBaht(amount)} แล้วไปแท็บ 「อัปโหลดสลิป」 — ระบบจะเติมเครดิตเมื่อสลิปผ่านเท่านั้น
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="rounded-full" onClick={() => void copyAccount()}>
                คัดลอกเลขพร้อมเพย์
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={amount < 20}
                onClick={() => {
                  setPaymentMethod("promptpay");
                  setTab("slip");
                }}
              >
                ไปอัปโหลดสลิป PromptPay
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl bg-surface p-5 shadow-border">
            <p className="text-sm text-muted">สแกน QR พร้อมเพย์ (ยอด {formatBaht(amount)})</p>
            <div className="mx-auto mt-4 grid h-56 w-56 place-items-center overflow-hidden rounded-2xl bg-white p-3 shadow-border">
              {qrUrl ? (
                <img src={qrUrl} alt={`PromptPay QR ${promptpay}`} className="h-full w-full object-contain" />
              ) : (
                <p className="px-3 text-center text-xs text-muted">{qrError || "กำลังสร้าง QR…"}</p>
              )}
            </div>
            <p className="mt-3 text-center font-mono text-xs text-muted">
              {promptpay} · {settings?.receive_name ?? "VELTSHOP"}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "wallet" ? (
        <div className="space-y-4 rounded-3xl bg-surface p-5 shadow-border">
          <div className="flex items-center justify-between">
            <p className="font-medium">อังเปา True Wallet</p>
            <Badge>ค่าธรรมเนียม {fee}%</Badge>
          </div>
          <p className="text-sm text-muted">
            โอนเข้าเบอร์ {settings?.wallet_phone || "ยังไม่ได้ตั้งค่าเบอร์รับเงิน"} · ค่าธรรมเนียม {fee}% · อัปโหลดสลิปเพื่อให้แอดมินตรวจมือ (ยังไม่มีตัวตรวจ True Wallet อัตโนมัติ)
          </p>
          <Button
            className="w-full rounded-full"
            disabled={amount < 20}
            onClick={() => {
              setPaymentMethod("truewallet");
              setTab("slip");
            }}
          >
            ไปอัปโหลดสลิป True Wallet
          </Button>
        </div>
      ) : null}

      {tab === "slip" ? (
        <div className="space-y-4 rounded-3xl bg-surface p-5 shadow-border">
          <div className="flex items-center justify-between">
            <p className="font-medium">อัปโหลดสลิป {paymentMethod === "promptpay" ? "PromptPay" : "True Wallet"}</p>
            {paymentMethod === "promptpay" ? <Badge tone="ok">บริการกลาง</Badge> : <Badge>รอตรวจมือ</Badge>}
          </div>
          <p className="text-sm text-muted">
            ยอดที่แจ้ง {formatBaht(amount)} · {paymentMethod === "promptpay" ? `ปลายทาง ${promptpay} · เติมเมื่อ verifier ยืนยันยอดและบัญชีตรงกันเท่านั้น` : `ปลายทาง ${settings?.wallet_phone || "ยังไม่ได้ตั้งค่าเบอร์รับเงิน"} · ไม่เติมอัตโนมัติจนกว่าแอดมินตรวจ`}
          </p>
          <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border bg-bg text-sm text-muted">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={checking || amount < 20}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onSlip(f);
                e.target.value = "";
              }}
            />
            {checking ? "กำลังตรวจสลิป…" : fileName ? fileName : "เลือกไฟล์สลิป"}
          </label>
        </div>
      ) : null}
    </div>
  );
}

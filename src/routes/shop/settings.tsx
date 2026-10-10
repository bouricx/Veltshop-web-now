import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getShopSettings, saveShopSettings, type ShopSettings } from "@/lib/shop/actions";
import { getAdminStatus } from "@/lib/shop/admin-gate";

export const Route = createFileRoute("/shop/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const [adminOk, setAdminOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!user || user.isDevFallback) {
      setAdminOk(false);
      return;
    }
    void getAdminStatus()
      .then((s) => setAdminOk(Boolean(s.isAdmin)))
      .catch(() => setAdminOk(false));
  }, [user, isPending]);

  if (isPending || adminOk === null) {
    return <p className="text-sm text-muted">กำลังตรวจสอบสิทธิ์…</p>;
  }
  if (!user || user.isDevFallback) return <RedirectToSignIn />;
  if (!adminOk) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center shadow-border">
        <p className="font-medium">เฉพาะแอดมิน</p>
        <p className="mt-2 text-sm text-muted">
          ตั้งค่าร้าน (พร้อมเพย์ / True Wallet) แก้ไขได้เฉพาะอีเมลใน ADMIN_EMAILS
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/shop">กลับหน้าร้าน</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">ร้าน</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">ตั้งค่าร้าน</h1>
      <p className="mt-2 text-sm text-muted">
        บัญชีรับเงินพร้อมเพย์และ True Wallet · ลูกค้าทั่วไปแก้ไม่ได้
      </p>
      <div className="mt-8">
        <SettingsForm />
      </div>
    </div>
  );
}

function SettingsForm() {
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getShopSettings().then(setForm);
  }, []);

  if (!form) return <p className="text-sm text-muted">กำลังโหลด…</p>;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = await saveShopSettings({
        data: {
          receive_account: form.receive_account.trim(),
          receive_name: form.receive_name.trim(),
          wallet_phone: form.wallet_phone.trim(),
          wallet_fee: Number(form.wallet_fee) || 0,
          slip_provider: form.slip_provider,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setForm(res.settings);
      toast.success("บันทึกตั้งค่าแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ไม่มีสิทธิ์แก้ไข");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className="space-y-4 rounded-3xl bg-surface p-5 shadow-border"
    >
      <div className="space-y-1.5">
        <Label htmlFor="pp">เลขพร้อมเพย์ / บัญชีรับเงิน</Label>
        <Input id="pp" value={form.receive_account} inputMode="numeric" required readOnly />
        <p className="text-xs text-muted">
          ล็อกให้ตรงกับบริการตรวจสลิปปัจจุบัน หากเปลี่ยนต้องตั้ง verifier ให้รับบัญชีใหม่ก่อน
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">ชื่อบัญชีที่แสดง</Label>
        <Input
          id="name"
          value={form.receive_name}
          onChange={(e) => setForm({ ...form, receive_name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wallet">เบอร์ True Wallet</Label>
        <Input
          id="wallet"
          value={form.wallet_phone}
          onChange={(e) => setForm({ ...form, wallet_phone: e.target.value })}
          inputMode="numeric"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fee">ค่าธรรมเนียม True Wallet (%)</Label>
        <Input
          id="fee"
          type="number"
          min={0}
          max={20}
          value={form.wallet_fee}
          onChange={(e) => setForm({ ...form, wallet_fee: Number(e.target.value) || 0 })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="provider">ผู้ให้บริการตรวจสลิป (บันทึกค่า — เว็บใช้บริการกลาง :8787)</Label>
        <select
          id="provider"
          className="flex h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm"
          value={form.slip_provider}
          onChange={(e) =>
            setForm({
              ...form,
              slip_provider: e.target.value === "slip2go" ? "slip2go" : "thunder",
            })
          }
        >
          <option value="thunder">thunder</option>
          <option value="slip2go">slip2go</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" className="rounded-full" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </Button>
        <Button asChild type="button" variant="secondary" className="rounded-full">
          <Link to="/admin">แอดมินเต็ม</Link>
        </Button>
      </div>
    </form>
  );
}

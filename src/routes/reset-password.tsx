import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/reset-password")({
  validateSearch: (v: Record<string, unknown>) => ({
    token: typeof v.token === "string" ? v.token : "",
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>
      {done ? (
        <>
          <p className="mt-4">เปลี่ยนรหัสผ่านแล้ว</p>
          <Link to="/login">เข้าสู่ระบบ</Link>
        </>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void authClient
              .resetPassword({ token, newPassword: password })
              .then((r) => {
                if (r.error) toast.error("ลิงก์ไม่ถูกต้องหรือหมดอายุ");
                else setDone(true);
              })
              .finally(() => setBusy(false));
          }}
        >
          <Label htmlFor="reset-password">รหัสผ่านใหม่ อย่างน้อย 10 ตัวอักษร</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button disabled={busy || !token} type="submit">
            ยืนยันรหัสผ่านใหม่
          </Button>
        </form>
      )}
    </main>
  );
}

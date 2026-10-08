import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** Opens a short prompt that sends customers to real auth at /login. */
export function LoginDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title="เข้าสู่ระบบ">
        <p className="mb-4 text-sm text-muted">
          ใช้บัญชีจริง (อีเมล+รหัสผ่าน หรือ Google / X) — รหัสผ่านถูกเก็บแบบ hash เท่านั้น
        </p>
        <Button asChild className="w-full rounded-full">
          <Link to="/login">ไปหน้าเข้าสู่ระบบ / สมัครสมาชิก</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

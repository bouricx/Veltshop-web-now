import { authCapabilities } from "@/lib/shop/access";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useShop } from "@/lib/shop/store";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const loginShop = useShop((s) => s.login);
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEnabled, setResetEnabled] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    void authCapabilities().then((r) => {
      setGoogle(r.google);
      setResetEnabled(r.emailReset);
    });
  }, []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
    loginShop(user.displayName || user.primaryEmail || "สมาชิก");
    void nav({ to: "/shop" });
  }, [isPending, user, loginShop, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authEnabled) {
      toast.error("ระบบสมาชิกยังไม่เปิด");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "สมาชิก",
        });
        if (error) throw new Error(error.message || "สมัครไม่สำเร็จ");
        toast.success("สมัครสมาชิกสำเร็จ");
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
        toast.success("เข้าสู่ระบบแล้ว");
      }
      loginShop(name.trim() || email.split("@")[0] || "สมาชิก");
      void nav({ to: "/shop" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <BrandMark to="/shop" />
          <Link to="/shop" className="text-sm text-muted hover:text-fg">
            หน้าร้าน
          </Link>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            เข้าสู่ระบบเพื่อซื้อสินค้า รับสินค้า และติดตามคำสั่งซื้อ
          </p>
        </div>

        {!authEnabled ? (
          <p className="text-sm text-muted">ระบบสมาชิกปิดอยู่</p>
        ) : (
          <>
            {resetEnabled ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (!email.trim()) {
                    toast.error("ใส่อีเมลก่อน");
                    return;
                  }
                  void authClient
                    .requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" })
                    .then(() => toast.success("หากพบบัญชี ระบบจะส่งลิงก์ไปยังอีเมล"));
                }}
              >
                ลืมรหัสผ่าน
              </Button>
            ) : null}
            {google ? (
              <Button
                className="w-full"
                onClick={() =>
                  void authClient.signIn.social({ provider: "google", callbackURL: "/shop" })
                }
              >
                เข้าสู่ระบบด้วย Google
              </Button>
            ) : null}
            {import.meta.env.VITE_GROK_OAUTH === "true" ? (
              <>
                <div className="flex gap-2">
                  {GROK_PROVIDERS.map((p) => (
                    <button
                      key={p.providerId}
                      type="button"
                      onClick={() => void signIn(p.providerId, { callbackURL: "/shop" })}
                      className="min-h-11 flex-1 rounded-full border border-black/10 bg-soft px-3 text-sm hover:bg-surface-2"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="h-px flex-1 bg-black/10" />
                  หรือใช้อีเมล
                  <div className="h-px flex-1 bg-black/10" />
                </div>
              </>
            ) : null}
            <form className="space-y-3" onSubmit={onSubmit}>
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">ชื่อที่แสดง</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อในร้าน"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 10 ตัวอักษร"
                />
              </div>
              <Button type="submit" disabled={busy || isPending} className="w-full rounded-full">
                {busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </Button>
            </form>
            <button
              type="button"
              disabled={isPending || busy}
              className="w-full text-center text-sm text-muted hover:text-fg"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            >
              {mode === "signin" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

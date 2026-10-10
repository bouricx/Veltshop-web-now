import { ImageEditor } from "@/components/shop/image-editor";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyGate } from "@/components/shop/shop-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authClient, signOut } from "@/lib/auth/client";
import { myAccountData } from "@/lib/shop/operations";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/shop/profile")({ component: ProfilePage });
function ProfilePage() {
  const { user } = useCurrentUserState();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">บัญชีของฉัน</h1>
      <EmptyGate>
        <ProfileBody key={user?.id ?? "out"} />
      </EmptyGate>
    </div>
  );
}
function ProfileBody() {
  const [data, setData] = useState<Awaited<ReturnType<typeof myAccountData>> | null>(null),
    [name, setName] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    void myAccountData()
      .then((d) => {
        setData(d);
        setName(d.profile?.name ?? "");
      })
      .catch(() => setError("โหลดบัญชีไม่สำเร็จ"));
  useEffect(load, []);
  return (
    <div className="mt-6 space-y-6">
      {error ? <p role="alert">{error}</p> : null}
      {data?.profile ? (
        <section className="rounded-2xl bg-surface p-5">
          <div className="flex gap-4">
            <img
              src={data.profile.image || "/favicon.svg"}
              alt="รูปโปรไฟล์"
              className="size-16 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold">{data.profile.name}</p>
              <p className="text-sm text-muted">{data.profile.email}</p>
              <p className="text-sm" style={{ color: data.profile.rank_color }}>
                {data.profile.rank}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <p className="col-span-2">
              สมัครเมื่อ{" "}
              {new Date(data.profile.created_at).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
              })}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted">
            เข้าสู่ระบบล่าสุด{" "}
            {data.profile.last_login
              ? new Date(data.profile.last_login).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                })
              : "ยังไม่มีบันทึก"}
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link to="/shop/cart">รายการสินค้าที่ส่งให้ร้าน</Link>
          </Button>
        </section>
      ) : null}
      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void authClient.updateUser({ name }).then((r) => {
            if (r.error) toast.error("เปลี่ยนชื่อไม่สำเร็จ");
            else {
              toast.success("เปลี่ยนชื่อแล้ว");
              load();
            }
          });
        }}
      >
        <ImageEditor
          kind="profile"
          value={data?.profile?.image ?? ""}
          onSaved={(image) => {
            void authClient.updateUser({ image }).then((r) => {
              if (r.error) toast.error("เปลี่ยนรูปไม่สำเร็จ");
              else {
                toast.success("เปลี่ยนรูปแล้ว");
                load();
              }
            });
          }}
        />
        <Label htmlFor="profile-name">ชื่อที่แสดง</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
        <Button type="submit" variant="secondary">
          เปลี่ยนชื่อ
        </Button>
      </form>
      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void authClient
            .changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
            .then((r) => {
              if (r.error) toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ");
              else {
                setCurrentPassword("");
                setNewPassword("");
                toast.success("เปลี่ยนรหัสผ่านแล้ว");
              }
            });
        }}
      >
        <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={10}
          required
        />
        <Button variant="secondary" type="submit">
          เปลี่ยนรหัสผ่าน / ออกจากอุปกรณ์อื่น
        </Button>
      </form>
      <Button
        variant="secondary"
        onClick={() => {
          if (!window.confirm("ออกจากระบบทุกอุปกรณ์?")) return;
          void authClient.revokeSessions().then((r) => {
            if (r.error) toast.error("ยกเลิก session ไม่สำเร็จ");
            else void signOut("/login");
          });
        }}
      >
        ออกจากระบบทุกอุปกรณ์
      </Button>

    </div>
  );
}

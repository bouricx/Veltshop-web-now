import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useCart } from "@/lib/shop/cart-store";
import { listMyCartRequests, submitCartRequest, type CartRequest } from "@/lib/shop/cart-requests";
import { formatBaht } from "@/lib/utils";
import { RequestSummary } from "./request-summary";

export function CartPage() {
  const { user, isPending } = useCurrentUserState();
  const items = useCart((s) => s.items),
    quantity = useCart((s) => s.quantity),
    remove = useCart((s) => s.remove),
    clear = useCart((s) => s.clear);
  const [contact, setContact] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<{ id: string; total: number } | null>(null),
    [requests, setRequests] = useState<CartRequest[]>([]),
    [historyError, setHistoryError] = useState(""),
    [revision, setRevision] = useState(0);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const userId = user && !user.isDevFallback ? user.id : undefined;
  useEffect(() => {
    setContact(user?.primaryEmail || "");
    setNote("");
    retry.current = null;
    if (!userId) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(`veltshop-cart-submit:${userId}`) || "null");
      if (saved && typeof saved.signature === "string" && typeof saved.key === "string") {
        const payload = JSON.parse(saved.signature);
        if (typeof payload.contact === "string" && typeof payload.note === "string") {
          setContact(payload.contact);
          setNote(payload.note);
          retry.current = saved;
        }
      }
    } catch {
      /* A damaged pending draft cannot override validated server data. */
    }
  }, [userId, user?.primaryEmail]);
  useEffect(() => {
    if (!userId) {
      setRequests([]);
      return;
    }
    let active = true;
    const load = () =>
      void listMyCartRequests()
        .then((v) => {
          if (active) {
            setRequests(v);
            setHistoryError("");
          }
        })
        .catch(() => {
          if (active) setHistoryError("โหลดรายการที่ส่งไว้ไม่สำเร็จ");
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [userId, revision]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !items.length || !userId) return;
    setBusy(true);
    setError("");
    const payload = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      contact: contact.trim(),
      note: note.trim(),
    };
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    try {
      try {
        sessionStorage.setItem(`veltshop-cart-submit:${userId}`, JSON.stringify(retry.current));
      } catch {
        /* Retry still works for this page. */
      }
      const r = await submitCartRequest({ data: { ...payload, key: retry.current.key } });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSuccess({ id: r.id, total: r.total });
      try {
        sessionStorage.removeItem(`veltshop-cart-submit:${userId}`);
      } catch {
        /* Submission already committed. */
      }
      clear();
      setNote("");
      retry.current = null;
      setRevision((v) => v + 1);
    } catch {
      setError("ยังยืนยันการส่งไม่ได้ กรุณาลองอีกครั้งด้วยรายการเดิม");
    } finally {
      setBusy(false);
    }
  }
  const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs text-muted">เลือกสินค้าแล้วให้ร้านดูแลต่อ</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <ShoppingCart className="size-6" />
          ตะกร้าสินค้า
        </h1>
        <p className="mt-2 text-sm text-muted">
          ส่งรายการให้ร้านโดยไม่ต้องชำระเงิน ไม่หักเครดิต และยังไม่จองสต็อกหรือจัดส่งสินค้า
        </p>
      </div>
      {success ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
        >
          <CheckCircle2 className="mb-2 size-6" />
          <h2 className="font-semibold">ส่งรายการให้ร้านแล้ว</h2>
          <p className="mt-2 break-all text-sm">เลขรายการ: {success.id}</p>
          <p className="mt-1 text-sm">
            ยอดตามรายการ {formatBaht(success.total)} · ยังไม่ได้ชำระเงิน
          </p>
          <p className="mt-2 text-sm">ร้านจะตรวจสอบสินค้าและติดต่อกลับตามช่องทางที่แจ้งไว้</p>
        </div>
      ) : null}
      {items.length ? (
        <form
          onSubmit={(e) => void submit(e)}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]"
        >
          <div className="space-y-3">
            {items.map((i) => (
              <article
                key={i.productId}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <h2 className="break-words font-semibold">{i.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  ราคาโดยประมาณ {formatBaht(i.price)} / ชิ้น
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || i.quantity <= 1}
                      aria-label={`ลดจำนวน ${i.name}`}
                      onClick={() => {
                        setError("");
                        quantity(i.productId, i.quantity - 1);
                      }}
                    >
                      −
                    </Button>
                    <Input
                      className="w-20 text-center"
                      type="number"
                      min={1}
                      max={99}
                      required
                      aria-label={`จำนวน ${i.name}`}
                      value={i.quantity}
                      disabled={busy}
                      onChange={(e) => {
                        setError("");
                        quantity(i.productId, Number(e.target.value));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || i.quantity >= 99}
                      aria-label={`เพิ่มจำนวน ${i.name}`}
                      onClick={() => {
                        setError("");
                        quantity(i.productId, i.quantity + 1);
                      }}
                    >
                      +
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      remove(i.productId);
                    }}
                    aria-label={`นำ ${i.name} ออกจากตะกร้า`}
                  >
                    <Trash2 className="size-4" />
                    นำออก
                  </Button>
                </div>
                <p className="mt-3 text-right font-semibold">{formatBaht(i.price * i.quantity)}</p>
              </article>
            ))}
          </div>
          <div className="min-w-0 space-y-4 self-start rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">สรุปรายการ</h2>
            <div className="flex justify-between gap-3 text-sm">
              <span>{items.reduce((n, i) => n + i.quantity, 0)} ชิ้น</span>
              <span className="font-semibold">{formatBaht(total)}</span>
            </div>
            <p className="text-xs text-muted">
              ร้านจะยืนยันราคาและสต็อกอีกครั้ง ยอดนี้ยังไม่ใช่การชำระเงิน
            </p>
            <div>
              <Label htmlFor="cart-contact">ช่องทางให้ร้านติดต่อกลับ</Label>
              <Input
                id="cart-contact"
                className="mt-2"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="เบอร์โทร / LINE / อีเมล"
                required
                minLength={3}
                maxLength={300}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cart-note">รายละเอียดเพิ่มเติม (ไม่จำเป็น)</Label>
              <Textarea
                id="cart-note"
                className="mt-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                disabled={busy}
                placeholder="เช่น ตัวเลือกสินค้าที่ต้องการ · ไม่ต้องใส่รหัสผ่าน"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {isPending ? (
              <p>กำลังตรวจสอบบัญชี…</p>
            ) : userId ? (
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "กำลังส่งรายการ…" : "ส่งรายการให้ร้าน · ไม่ต้องชำระเงิน"}
              </Button>
            ) : (
              <>
                <p className="text-sm text-muted">เข้าสู่ระบบเพื่อส่งรายการและติดตามสถานะ</p>
                <Button asChild className="w-full">
                  <Link to="/login">เข้าสู่ระบบเพื่อส่งรายการ</Link>
                </Button>
              </>
            )}
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <ShoppingCart className="mx-auto size-9 text-muted" />
          <p className="mt-3 font-medium">ยังไม่มีสินค้าในตะกร้า</p>
          <Button asChild className="mt-4">
            <Link to="/shop/catalog" search={{ cat: "all" }}>
              เลือกสินค้า
            </Link>
          </Button>
        </div>
      )}
      {userId ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">รายการที่ส่งให้ร้าน</h2>
          {historyError ? (
            <p role="alert" className="text-sm text-danger">
              {historyError}
            </p>
          ) : null}
          {requests.map((r) => (
            <RequestSummary key={r.id} request={r} />
          ))}
          {!requests.length && !historyError ? (
            <p className="text-sm text-muted">ยังไม่มีรายการที่ส่ง</p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

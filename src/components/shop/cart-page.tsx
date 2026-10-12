import { GiftCodePanel } from "./gift-code-panel";
import type { CartQuote } from "@/lib/shop/cart-quote";
import { sameQuote } from "@/lib/shop/cart-quote";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Trash2, CheckCircle2, ReceiptText, Info, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useCart } from "@/lib/shop/cart-store";
import {
  getCartQuote,
  listMyCartRequests,
  submitCartRequest,
  type CartRequest,
} from "@/lib/shop/cart-requests";
import { listProducts } from "@/lib/shop/actions";
import { formatBaht } from "@/lib/utils";
import { RequestSummary } from "./request-summary";
import { ProductMark } from "./product-mark";
import { CartPaymentPanel } from "./cart-payment-panel";
import { AdminContactPicker } from "./admin-contact-picker";
import { useSiteConfiguration } from "@/lib/shop/site-state";
import { CheckoutGuide } from "./checkout-guide";
import { OrderContactActions } from "./order-contact-actions";

export function CartPage() {
  const { user, isPending } = useCurrentUserState();
  const site = useSiteConfiguration((s) => s.value);
  const items = useCart((s) => s.items),
    syncProductMarks = useCart((s) => s.syncProductMarks),
    setQuantity = useCart((s) => s.quantity),
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
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [acceptedQuote, setAcceptedQuote] = useState<CartQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteRevision, setQuoteRevision] = useState(0);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    void listProducts()
      .then((products) => {
        if (active) syncProductMarks(products);
      })
      .catch(() => {
        /* Saved mark colors remain visible when the catalog is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [syncProductMarks]);
  const userId = user && !user.isDevFallback ? user.id : undefined;
  const quoteLines = JSON.stringify(
    items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  );
  useEffect(() => {
    setAcceptedQuote(null);
    setQuote(null);
    setQuoteError("");
    if (!userId || !items.length) return;
    let active = true,
      sequence = 0;
    const load = async () => {
      const current = ++sequence;
      setQuoteBusy(true);
      try {
        const r = await getCartQuote({ data: { items: JSON.parse(quoteLines), coupon } });
        if (!active || sequence !== current) return;
        if (!r.ok) {
          setQuote(null);
          setAcceptedQuote(null);
          setQuoteError(r.message);
          return;
        }
        setQuote(r.quote);
        setAcceptedQuote((previous) =>
          previous && sameQuote(previous, r.quote) ? previous : null,
        );
      } catch {
        if (active && sequence === current) {
          setQuoteError("ตรวจยอดไม่ได้ กรุณาโหลดใหม่ก่อนยืนยัน");
          setAcceptedQuote(null);
        }
      } finally {
        if (active && sequence === current) setQuoteBusy(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [userId, quoteLines, coupon, quoteRevision, items.length]);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    setContact("");
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
  }, [userId]);
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
    if (
      busy ||
      !items.length ||
      !userId ||
      !acceptedQuote ||
      quoteBusy ||
      !quote ||
      !sameQuote(acceptedQuote, quote)
    )
      return;
    setBusy(true);
    setError("");
    const payload = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      contact: contact.trim(),
      note: note.trim(),
      coupon,
      acceptedQuote,
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
        if ("code" in r && r.code === "PRICE_CHANGED") {
          setQuote(r.quote);
          setAcceptedQuote(null);
          retry.current = null;
        }
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
  const subtotal = quote?.subtotal ?? items.reduce((n, i) => n + i.price * i.quantity, 0);
  const total = quote?.total ?? subtotal;
  const createdRequest = requests.find((r) => r.id === success?.id);
  return (
    <section className="cart-page space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          VELTSHOP · รายการที่เลือก
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingCart className="size-6" aria-hidden="true" />
          ตะกร้าสินค้า
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium text-muted">
            {totalQuantity} ชิ้น
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          ตรวจรายการให้ครบ ชำระด้วยพร้อมเพย์ แล้วแนบสลิปเพื่อรอยืนยันยอดเงิน
        </p>
      </div>
      <CheckoutGuide />
      {success ? (
        createdRequest ? (
          <RequestSummary request={createdRequest} showPayment initialPaymentOpen />
        ) : (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
          >
            <CheckCircle2 className="mb-2 size-6" />
            <h2 className="font-semibold">สร้างรายการสั่งซื้อแล้ว</h2>
            <p className="mt-2 break-all text-sm">เลขรายการ: {success.id}</p>
            <p className="mt-1 text-sm">ยอดชำระ {formatBaht(success.total)}</p>
            <p className="mt-2 text-sm">ชำระภายใน 5 นาที แล้วแนบสลิปในช่องด้านล่างเพื่อตรวจสอบ</p>
            <CartPaymentPanel
              id={success.id}
              paymentStatus={requests.find((r) => r.id === success.id)?.payment_status ?? "unpaid"}
            />
            <OrderContactActions id={success.id} total={success.total} />
            <AdminContactPicker
              facebookUrl={site.facebook}
              discordUrl={site.discord}
              description="หากระบบตรวจสลิปไม่ได้ ให้ติดต่อแอดมินพร้อมเลขรายการนี้"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              ติดต่อแอดมินกรณีมีปัญหา
            </AdminContactPicker>
          </div>
        )
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
                className="cart-item rounded-2xl border border-border bg-surface p-4 shadow-border sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ProductMark
                    name={i.name}
                    color={i.markColor}
                    className="size-10 rounded-xl text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold">{i.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      ราคา{" "}
                      {formatBaht(
                        quote?.items.find((q) => q.productId === i.productId)?.price ?? i.price,
                      )}{" "}
                      / ชิ้น
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="mr-1 shrink-0 whitespace-nowrap text-xs text-muted">
                      จำนวน
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || i.quantity <= 1}
                      aria-label={`ลดจำนวน ${i.name}`}
                      onClick={() => {
                        setError("");
                        setQuantity(i.productId, i.quantity - 1);
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
                        setQuantity(i.productId, Number(e.target.value));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || i.quantity >= 99}
                      aria-label={`เพิ่มจำนวน ${i.name}`}
                      onClick={() => {
                        setError("");
                        setQuantity(i.productId, i.quantity + 1);
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
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-sm text-muted">รวมสินค้านี้</span>
                  <span className="font-semibold tabular-nums">
                    {formatBaht(
                      quote?.items.find((q) => q.productId === i.productId)?.lineTotal ??
                        i.price * i.quantity,
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-summary min-w-0 space-y-4 self-start rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <ReceiptText className="size-4" aria-hidden="true" />
              สรุปรายการ
            </h2>
            <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">จำนวนสินค้ารวม</span>
                <span className="font-medium">{totalQuantity} ชิ้น</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <span className="font-medium">ยอดสุทธิ</span>
                <span className="font-bold">{formatBaht(total)}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4">
              <Label htmlFor="cart-coupon">โค้ดส่วนลด</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="cart-coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="กรอกโค้ดส่วนลด"
                  maxLength={128}
                />
                <Button
                  type="button"
                  disabled={busy || quoteBusy || !userId}
                  onClick={() => {
                    setCoupon(couponInput.trim().toUpperCase());
                    setQuoteRevision((v) => v + 1);
                  }}
                >
                  ใช้โค้ด
                </Button>
              </div>
              {coupon ? (
                <button
                  type="button"
                  className="mt-2 text-sm underline"
                  onClick={() => {
                    setCoupon("");
                    setCouponInput("");
                  }}
                >
                  ยกเลิกโค้ด {coupon}
                </button>
              ) : null}
              {quote?.discount ? (
                <p className="mt-2 text-sm text-ok">
                  ยอดก่อนลด {formatBaht(quote.subtotal)} · ส่วนลด {formatBaht(quote.discount)}
                </p>
              ) : null}
            </div>
            {quoteError ? (
              <div role="alert" className="text-sm text-danger">
                {quoteError}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setQuoteRevision((v) => v + 1)}
                >
                  ตรวจยอดใหม่
                </Button>
              </div>
            ) : null}
            {userId && quote && !acceptedQuote ? (
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <p className="text-sm">
                  ตรวจราคาปัจจุบันและยอดสุทธิ {formatBaht(total)} ก่อนยืนยัน หากราคาเปลี่ยน
                  ระบบจะให้ตรวจใหม่
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={quoteBusy}
                  onClick={() => setAcceptedQuote(quote)}
                >
                  ยอมรับยอด {formatBaht(total)}
                </Button>
              </div>
            ) : null}
            <p className="flex gap-2 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ระบบคำนวณยอดจากราคาปัจจุบัน แล้วจะแสดง QR สำหรับชำระเงินหลังสร้างรายการ
            </p>
            <div>
              <Label htmlFor="cart-contact">ช่องทางให้ร้านติดต่อกลับ</Label>
              <Input
                id="cart-contact"
                className="mt-2"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="ลิงก์ Facebook หรือชื่อผู้ใช้ Discord"
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
              <Button
                type="submit"
                className="w-full"
                disabled={busy || quoteBusy || !acceptedQuote}
              >
                {busy ? "กำลังสร้างรายการ…" : "สร้างรายการและชำระด้วย QR"}
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
      ) : !success ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <ShoppingCart className="mx-auto size-9 text-muted" />
          <p className="mt-3 font-medium">ยังไม่มีสินค้าในตะกร้า</p>
          <Button asChild className="mt-4">
            <Link to="/shop/catalog" search={{ cat: "all" }}>
              เลือกสินค้า
            </Link>
          </Button>
        </div>
      ) : null}
      {userId ? <GiftCodePanel products={items} /> : null}
      {userId ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">รายการสั่งซื้อของฉัน</h2>
          <p className="text-xs text-muted">
            สถานะอัปเดตอัตโนมัติทุก 15 วินาที · ไม่ต้องส่งสลิปซ้ำ
          </p>
          {historyError ? (
            <p role="alert" className="text-sm text-danger">
              {historyError}
            </p>
          ) : null}
          {requests
            .filter((r) => r.id !== success?.id)
            .map((r) => (
              <RequestSummary key={r.id} request={r} showPayment />
            ))}
          {!requests.length && !historyError ? (
            <p className="text-sm text-muted">ยังไม่มีรายการที่ส่ง</p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

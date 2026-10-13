import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import {
  getCartClaims,
  fileCartClaim,
  listAdminCartClaims,
  resolveCartClaim,
} from "@/lib/shop/cart-claims";
import { ShieldCheck } from "lucide-react";
const labels: Record<string, string> = {
  pending: "รอตรวจสอบ",
  accepted: "รับเรื่องแล้ว",
  rejected: "ปฏิเสธ",
  closed: "ปิดเคลม",
  replaced: "เปลี่ยนสินค้าแล้ว",
  refunded: "คืนเครดิตแล้ว",
};
export function CartClaimPanel({ id }: { id: string }) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Awaited<ReturnType<typeof getCartClaims>> | null>(null),
    [productId, setProductId] = useState(""),
    [title, setTitle] = useState(""),
    [message, setMessage] = useState(""),
    [evidence, setEvidence] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const load = useCallback(
    () =>
      getCartClaims({ data: { requestId: id } })
        .then(setData)
        .catch(() => setFeedback("โหลดประกันและเคลมไม่ได้ กรุณาลองใหม่")),
    [id],
  );
  useEffect(() => {
    if (!open) return;
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [open, load]);
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        <ShieldCheck className="size-4" />
        {open ? "ซ่อนการเคลม" : "เคลมสินค้า / ตรวจประกัน"}
      </Button>
      {open && data ? (
        <div className="mt-4 space-y-3">
          <ul className="space-y-2">
            {data.items.map((i) => (
              <li key={i.productId} className="text-sm">
                {i.name} ·{" "}
                {i.eligible
                  ? `รับประกันถึง ${new Date(i.end).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`
                  : i.reason}
              </li>
            ))}
          </ul>
          {data.items.some((i) => i.eligible) ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setFeedback("");
                try {
                  const r = await fileCartClaim({
                    data: { requestId: id, productId, title, message, evidence },
                  });
                  setFeedback(r.ok ? "ส่งเคลมแล้ว ทีมงานจะตรวจสอบ" : r.message);
                  if (r.ok) {
                    setTitle("");
                    setMessage("");
                    setEvidence("");
                    await load();
                  }
                } catch {
                  setFeedback("ส่งเคลมไม่ได้ กรุณาลองใหม่");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Label htmlFor={`claim-product-${id}`}>สินค้าที่มีปัญหา</Label>
              <NativeSelect
                id={`claim-product-${id}`}
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">เลือกสินค้า</option>
                {data.items
                  .filter((i) => i.eligible)
                  .map((i) => (
                    <option key={i.productId} value={i.productId}>
                      {i.name}
                    </option>
                  ))}
              </NativeSelect>
              <Label htmlFor={`claim-title-${id}`}>หัวข้อ</Label>
              <Input
                id={`claim-title-${id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
              <Label htmlFor={`claim-message-${id}`}>อธิบายปัญหา</Label>
              <Textarea
                id={`claim-message-${id}`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={3}
                maxLength={2000}
              />
              <Label htmlFor={`claim-evidence-${id}`}>ลิงก์หลักฐาน HTTPS (ไม่จำเป็น)</Label>
              <Input
                id={`claim-evidence-${id}`}
                type="url"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://…"
              />
              <Button disabled={busy} type="submit">
                {busy ? "กำลังส่ง…" : "ส่งเคลมสินค้า"}
              </Button>
            </form>
          ) : null}
          {data.claims.map((c) => (
            <article key={c.id} className="rounded-xl bg-surface p-3 text-sm">
              <p className="font-semibold">
                {c.title} · {labels[c.status] || c.status}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.reply || "ทีมงานยังไม่ได้ตอบกลับ"}</p>
            </article>
          ))}
        </div>
      ) : open && !feedback ? (
        <p className="mt-3 text-sm">กำลังตรวจประกัน…</p>
      ) : null}
      {feedback ? (
        <p role="status" className="mt-3 text-sm">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
export function AdminCartClaims() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminCartClaims>>>([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    void listAdminCartClaims()
      .then(setRows)
      .catch(() => setError("ดูเคลมต้องมีสิทธิ์จัดการเคลม"));
  }, [revision]);
  return (
    <details className="rounded-2xl border border-border bg-surface p-4">
      <summary className="cursor-pointer font-semibold">
        เคลมออเดอร์จากตะกร้า ({rows.length})
      </summary>
      {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {rows.map(({ result: c }) => (
          <AdminClaimRow key={c.id} claim={c} refresh={() => setRevision((v) => v + 1)} />
        ))}
      </div>
    </details>
  );
}
function AdminClaimRow({
  claim: c,
  refresh,
}: {
  claim: Awaited<ReturnType<typeof listAdminCartClaims>>[number]["result"];
  refresh: () => void;
}) {
  const [status, setStatus] = useState("accepted"),
    [reply, setReply] = useState(""),
    [replacement, setReplacement] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <article className="space-y-3 rounded-xl border border-border p-4">
      <p className="font-semibold">
        {c.title} · {labels[c.status]}
      </p>
      <p className="break-all text-xs text-muted">
        ออเดอร์ {c.requestId} · สินค้า {c.productId}
      </p>
      <p className="whitespace-pre-wrap text-sm">{c.message}</p>
      {c.evidence ? (
        <a
          href={c.evidence}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          เปิดหลักฐาน
        </a>
      ) : null}
      {c.reply ? <p className="text-sm">ตอบกลับ: {c.reply}</p> : null}
      {["pending", "accepted"].includes(c.status) ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !confirmed) return;
            setBusy(true);
            try {
              const r = await resolveCartClaim({
                data: {
                  id: c.id,
                  status: status as "accepted" | "rejected" | "closed" | "replaced" | "refunded",
                  reply,
                  replacement,
                  confirmed: true,
                },
              });
              setMessage(r.ok ? "บันทึกแล้ว" : r.message);
              if (r.ok) {
                setReplacement("");
                refresh();
              }
            } catch {
              setMessage("บันทึกไม่ได้ ตรวจสิทธิ์แล้วลองใหม่");
            } finally {
              setBusy(false);
            }
          }}
        >
          <NativeSelect
            aria-label="ผลดำเนินการเคลม"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setConfirmed(false);
            }}
          >
            {["accepted", "rejected", "closed", "replaced", "refunded"].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
                {s === "refunded" ? " (เข้ากระเป๋าเครดิต)" : ""}
              </option>
            ))}
          </NativeSelect>
          <Textarea
            aria-label="คำตอบถึงลูกค้า"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            required
            minLength={3}
            maxLength={2000}
            placeholder="เหตุผล / คำตอบถึงลูกค้า"
          />
          {status === "replaced" ? (
            <Textarea
              aria-label="ข้อมูลสินค้าทดแทน"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              required
              maxLength={10000}
              placeholder="รหัสสินค้าทดแทน จะเก็บแบบเข้ารหัส"
            />
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            <span>
              ตรวจข้อมูลแล้วและยืนยันดำเนินการ
              {status === "refunded" ? " คืนเครดิตตามยอดสินค้าที่ชำระจริง และเพิกถอนรหัสเดิม" : ""}
            </span>
          </label>
          <Button type="submit" disabled={busy || !confirmed}>
            {busy ? "กำลังบันทึก…" : "ยืนยันผลเคลม"}
          </Button>
        </form>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </article>
  );
}

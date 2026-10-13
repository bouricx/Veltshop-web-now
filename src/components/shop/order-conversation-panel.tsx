import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import {
  getMyOrderConversation,
  getAdminOrderConversation,
  sendMyOrderMessage,
  sendAdminOrderMessage,
} from "@/lib/shop/order-support";
import { onShopChange } from "@/lib/shop/realtime-client";
type Page = Awaited<ReturnType<typeof getMyOrderConversation>>;
type Message = Page["messages"][number];
function mergeMessages(a: Message[], b: Message[]) {
  return [...new Map([...a, ...b].map((message) => [message.id, message])).values()].sort(
    (x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id),
  );
}
export default function OrderConversationPanel({
  id,
  admin,
  onClose,
}: {
  id: string;
  admin: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [before, setBefore] = useState<Page["before"]>(null);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [olderBusy, setOlderBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reload, setReload] = useState(0);
  const retry = useRef<{ key: string; body: string } | null>(null),
    sending = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const scrollAfterSend = useRef(false);
  const initialized = useRef(false);
  useEffect(() => {
    let active = true,
      fetching = false;
    const load = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const page = await (admin ? getAdminOrderConversation : getMyOrderConversation)({
          data: { id },
        });
        if (active) {
          setMessages((previous) => mergeMessages(previous, page.messages));
          if (!initialized.current) {
            setBefore(page.before);
            initialized.current = true;
          }
          setLoaded(true);
          setError("");
          if (scrollAfterSend.current) {
            requestAnimationFrame(() => log.current?.scrollTo({ top: log.current.scrollHeight }));
            scrollAfterSend.current = false;
          }
        }
      } catch {
        if (active) {
          setMessages([]);
          setBefore(null);
          initialized.current = false;
          setLoaded(false);
          setError("โหลดบทสนทนาไม่ได้ กรุณาตรวจสิทธิ์และลองใหม่");
        }
      } finally {
        fetching = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    const unsubscribe = onShopChange(() => void load());
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, admin, reload]);
  async function older() {
    if (!before || olderBusy) return;
    setOlderBusy(true);
    setFeedback("");
    const height = log.current?.scrollHeight ?? 0;
    try {
      const page = await (admin ? getAdminOrderConversation : getMyOrderConversation)({
        data: { id, before },
      });
      setMessages((previous) => mergeMessages(previous, page.messages));
      setBefore(page.before);
      requestAnimationFrame(() => {
        if (log.current) log.current.scrollTop += log.current.scrollHeight - height;
      });
    } catch {
      setFeedback("โหลดข้อความก่อนหน้าไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setOlderBusy(false);
    }
  }
  async function send() {
    const text = body.trim();
    if (!text || sending.current || !loaded || error) return;
    sending.current = true;
    setBusy(true);
    setFeedback("");
    if (retry.current?.body !== text) retry.current = { key: crypto.randomUUID(), body: text };
    try {
      const result = await (admin ? sendAdminOrderMessage : sendMyOrderMessage)({
        data: { id, key: retry.current!.key, body: text },
      });
      setFeedback(result.message);
      if (result.ok) {
        setBody("");
        retry.current = null;
        scrollAfterSend.current = true;
        setReload((value) => value + 1);
      }
    } catch {
      setFeedback("ยังยืนยันผลการส่งไม่ได้ ข้อความยังอยู่ กรุณาลองส่งข้อความเดิมอีกครั้ง");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 text-fg">
      <div className="flex items-start gap-3">
        <MessageCircle
          className="mt-1 size-5 shrink-0 text-[var(--icon-blue)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{admin ? "บทสนทนากับลูกค้า" : "คุยกับทีมงานร้าน"}</h3>
          <p className="mt-1 text-xs text-muted">ข้อความผูกกับออเดอร์นี้ · อัปเดตขณะเปิดบทสนทนา</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
          aria-label="ปิดบทสนทนา"
        >
          <X className="size-4" />
        </Button>
      </div>
      {error ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-danger">
          {error}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            ลองใหม่
          </Button>
        </div>
      ) : null}
      {!loaded && !error ? (
        <p role="status" className="mt-4 text-sm text-muted">
          กำลังโหลดข้อความ…
        </p>
      ) : null}
      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="ข้อความในออเดอร์"
        className="mt-4 max-h-80 space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-surface p-3"
      >
        {before ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={olderBusy}
            onClick={() => void older()}
          >
            {olderBusy ? "กำลังโหลด…" : "โหลดข้อความก่อนหน้า"}
          </Button>
        ) : null}
        {loaded && !messages.length ? (
          <p className="py-4 text-center text-sm text-muted">
            ยังไม่มีข้อความ เริ่มสนทนาเกี่ยวกับสินค้าที่ได้รับได้เลย
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-4 py-3 ${message.mine ? "ml-auto bg-accent text-accent-fg" : "border border-border bg-surface-2 text-fg"}`}
          >
            <p className="text-xs font-semibold">
              {message.mine ? "คุณ" : message.role === "admin" ? "ทีมงาน" : message.name}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.body}
            </p>
            <p className="mt-2 text-[11px] opacity-80">
              {new Date(message.at).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </article>
        ))}
      </div>
      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Label htmlFor={`order-message-${id}`}>
          {admin ? "ข้อความถึงลูกค้า" : "ข้อความถึงทีมงาน"}
        </Label>
        <Textarea
          id={`order-message-${id}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          disabled={busy || !loaded || Boolean(error)}
          placeholder="สอบถามการใช้งานหรือแจ้งรายละเอียดเกี่ยวกับสินค้า…"
          className="min-h-24 bg-surface"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {body.length}/2,000 · ไม่ต้องส่งรหัสผ่านหรือ OTP ในแชต
          </span>
          <Button type="submit" disabled={busy || !loaded || Boolean(error) || !body.trim()}>
            <Send className="size-4" aria-hidden="true" />
            {busy ? "กำลังส่ง…" : "ส่งข้อความ"}
          </Button>
        </div>
      </form>
      {feedback ? (
        <p role="status" className="mt-3 text-sm">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

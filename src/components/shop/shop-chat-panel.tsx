import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Send, X, Trash2 } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { askShopAssistant, chatAvailability } from "@/lib/shop/chat";
import { useSiteConfiguration } from "@/lib/shop/site-state";
type Message = { role: "user" | "assistant"; content: string };

export default function ShopChatPanel({ onClose }: { onClose: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const site = useSiteConfiguration((s) => s.value);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const requestGeneration = generation;
    closeButton.current?.focus();
    void chatAvailability()
      .then((r) => {
        if (active) setAvailable(r.available);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
      requestGeneration.current++;
    };
  }, []);
  useEffect(() => {
    generation.current++;
    setMessages([]);
    setInput("");
    setError("");
    setPending(false);
  }, [user?.id]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, pending]);
  async function send() {
    const content = input.trim();
    if (!content || pending || !available || !user || user.isDevFallback) return;
    const previous = messages;
    let history = [
      ...messages.slice(-8).map((m) => ({ ...m, content: m.content.slice(0, 1200) })),
      { role: "user" as const, content },
    ];
    while (history.reduce((n, m) => n + m.content.length, 0) > 6000) history = history.slice(2);
    const current = ++generation.current;
    setPending(true);
    setError("");
    setMessages(history);
    setInput("");
    try {
      const answer = await askShopAssistant({ data: { messages: history } });
      if (current !== generation.current) return;
      if (!answer.ok) {
        setMessages(previous);
        setInput(content);
        setError(answer.message);
        return;
      }
      setMessages([...history, { role: "assistant", content: answer.text }]);
    } catch {
      if (current !== generation.current) return;
      setMessages(previous);
      setInput(content);
      setError("ส่งไม่สำเร็จ กรุณาลองอีกครั้งหรือเข้าสู่ระบบใหม่");
    } finally {
      if (current === generation.current) {
        setPending(false);
        field.current?.focus();
      }
    }
  }
  return (
    <section
      role="dialog"
      aria-label="ผู้ช่วย AI Veltshop"
      className="chat-panel"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="flex items-center gap-3 border-b border-border p-4">
        <span
          className="admin-group-icon"
          style={{ color: "var(--icon-purple)", background: "var(--surface-2)" }}
        >
          <Bot className="size-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">ผู้ช่วย Veltshop</h2>
          <p className="text-xs text-muted">ถามสินค้าและวิธีสั่งซื้อ</p>
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"
          aria-label="ล้างบทสนทนา"
          disabled={pending}
          onClick={() => {
            setMessages([]);
            setError("");
          }}
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl hover:bg-surface-2"
          aria-label="ปิดแชต"
          ref={closeButton}
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </header>
      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="บทสนทนา"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {!messages.length ? (
          <div className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed">
            สวัสดีค่ะ อยากดูสินค้าประเภทไหน หรือให้ช่วยอธิบายวิธีสั่งซื้อไหมคะ?
            <p className="mt-2 text-xs text-muted">
              คำตอบจาก AI อาจคลาดเคลื่อน โปรดตรวจรายละเอียดก่อนชำระเงิน และอย่าส่งรหัสผ่านหรือ OTP
            </p>
          </div>
        ) : null}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-accent text-accent-fg" : "bg-surface-2 text-fg"}`}
          >
            <span className="sr-only">{message.role === "user" ? "คุณ: " : "AI: "}</span>
            {message.content}
          </div>
        ))}
        {pending ? (
          <p role="status" className="text-sm text-muted">
            AI กำลังตอบ…
          </p>
        ) : null}
        {available === false ? (
          <p className="rounded-xl border border-border p-3 text-sm">
            แชต AI ยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมิน
          </p>
        ) : null}
        {!isPending && (!user || user.isDevFallback) ? (
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm text-accent-fg"
          >
            เข้าสู่ระบบเพื่อคุยกับ AI
          </Link>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="shop-chat-message" className="sr-only">
          ข้อความถึง AI
        </label>
        <div className="flex gap-2">
          <input
            id="shop-chat-message"
            ref={field}
            value={input}
            maxLength={1200}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ถามเกี่ยวกับสินค้า…"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg"
            disabled={pending || !available || !user || user.isDevFallback}
          />
          <button
            type="submit"
            aria-label="ส่งข้อความ"
            disabled={pending || !available || !input.trim() || !user || user.isDevFallback}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        <a
          href={site.facebook}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-muted underline"
        >
          ติดต่อแอดมินผ่าน Facebook
        </a>
      </form>
    </section>
  );
}

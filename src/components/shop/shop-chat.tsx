import { useState, useRef, lazy, Suspense } from "react";
import { MessageCircle } from "lucide-react";

const ChatPanel = lazy(() => import("./shop-chat-panel"));
export function ShopChat() {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  }
  return (
    <>
      {!open ? (
        <button
          ref={launcher}
          type="button"
          className="chat-launcher inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-accent px-4 text-sm font-semibold text-accent-fg shadow-lg"
          aria-haspopup="dialog"
          aria-label="เปิดแชต AI"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          แชต AI
        </button>
      ) : (
        <Suspense
          fallback={
            <div className="chat-panel p-5" role="status">
              กำลังเปิดแชต…
              <button type="button" className="mt-3 underline" onClick={close}>
                ปิด
              </button>
            </div>
          }
        >
          <ChatPanel onClose={close} />
        </Suspense>
      )}
    </>
  );
}

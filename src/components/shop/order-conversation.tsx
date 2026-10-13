import { lazy, Suspense, useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const ConversationPanel = lazy(() => import("./order-conversation-panel"));
export function OrderConversation({ id, admin = false }: { id: string; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { user, isPending } = useCurrentUserState();
  if (isPending || !user || user.isDevFallback) return null;
  return (
    <section className="mt-4" aria-label={admin ? "สนทนากับลูกค้า" : "สนทนากับทีมงาน"}>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-4 text-[var(--icon-blue)]" aria-hidden="true" />
          {admin ? "คุยกับลูกค้าในออเดอร์นี้" : "คุยกับทีมงานเรื่องออเดอร์นี้"}
        </Button>
      ) : (
        <div id={panelId}>
          <Suspense
            fallback={
              <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm">
                กำลังเปิดบทสนทนา…
              </p>
            }
          >
            <ConversationPanel
              key={`${id}:${admin}:${user.id}`}
              id={id}
              admin={admin}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </div>
      )}
    </section>
  );
}

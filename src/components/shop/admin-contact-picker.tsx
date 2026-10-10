import { ArrowUpRight, Facebook, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminContactPicker({
  facebookUrl,
  discordUrl,
  className,
  description = "เลือกช่องทางที่สะดวกเพื่อติดต่อทีมงาน",
  children,
}: {
  facebookUrl: string;
  discordUrl: string;
  className: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent title="เลือกช่องทางติดต่อแอดมิน">
        <p className="mb-4 text-sm leading-relaxed text-muted">{description}</p>
        <div className="grid gap-3">
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Facebook className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Facebook Page</span>
              <span className="block truncate text-xs text-muted">VELTSHOP</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </a>
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Discord</span>
              <span className="block truncate text-xs text-muted">เข้าร่วมเซิร์ฟ VELTSHOP</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

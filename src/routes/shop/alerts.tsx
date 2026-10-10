import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { shopMeta } from "@/lib/shop/meta";

export const Route = createFileRoute("/shop/alerts")({ component: AlertsPage });

function AlertsPage() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-surface px-6 py-12 text-center shadow-border">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-soft text-accent">
        <Bell className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">ยังไม่มีแจ้งเตือน</h1>
      <p className="mt-2 text-sm text-muted">
        ออเดอร์ เติมเงิน และข้อความจากแอดมินจะขึ้นที่นี่ ติดต่อร้านได้ด้านล่าง
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        <a
          href={shopMeta.discordInvite}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 font-medium text-accent-fg"
        >
          Discord
        </a>
        <a
          href={shopMeta.facebookUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 font-medium text-fg shadow-border"
        >
          Facebook
        </a>
      </div>

    </div>
  );
}

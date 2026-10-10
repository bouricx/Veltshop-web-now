import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { myAccountData } from "@/lib/shop/operations";
import { EmptyGate } from "@/components/shop/shop-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
export const Route = createFileRoute("/shop/alerts")({ component: AlertsPage });
function AlertsPage() {
  const { user } = useCurrentUserState();
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">แจ้งเตือน</h1>
      <EmptyGate>
        <Notifications key={user?.id ?? "out"} />
      </EmptyGate>
    </section>
  );
}
function Notifications() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof myAccountData>>["notifications"]>(
      [],
    ),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void myAccountData()
        .then((d) => {
          if (active) setItems(d.notifications);
        })
        .catch(() => {
          if (active) setError("โหลดแจ้งเตือนไม่สำเร็จ");
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="mt-5 space-y-3">
      {error ? <p>{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีแจ้งเตือน</p>
      ) : (
        items.map((n) => (
          <article key={n.id} className="rounded-xl border p-4">
            <h2 className="font-medium">{n.title}</h2>
            <p className="mt-2 text-sm">{n.body}</p>
            <p className="mt-2 text-xs text-muted">
              {new Date(n.created_at).toLocaleString("th-TH")}
            </p>
          </article>
        ))
      )}
    </div>
  );
}

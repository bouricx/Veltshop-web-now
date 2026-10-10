import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/payments/reconciliation")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin",
      search: { tab: "payments", status: "reconciliation_required" },
    });
  },
});

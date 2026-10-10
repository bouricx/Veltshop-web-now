import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/topups")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "payments" } });
  },
});

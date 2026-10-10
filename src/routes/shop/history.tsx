import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/shop/history")({
  beforeLoad: () => {
    throw redirect({ to: "/shop/cart" });
  },
});

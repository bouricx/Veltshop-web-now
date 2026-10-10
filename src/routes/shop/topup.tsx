import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/shop/topup")({
  beforeLoad: () => {
    throw redirect({ to: "/shop/cart" });
  },
});

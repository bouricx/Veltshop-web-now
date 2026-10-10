import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/shop/box")({
  beforeLoad: () => {
    throw redirect({ to: "/shop/cart" });
  },
});

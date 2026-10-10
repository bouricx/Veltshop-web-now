import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/shop/wheel")({
  beforeLoad: () => {
    throw redirect({ to: "/shop/cart" });
  },
});

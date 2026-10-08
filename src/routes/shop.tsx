import { createFileRoute } from "@tanstack/react-router";
import { ShopShell } from "@/components/shop/shop-shell";

export const Route = createFileRoute("/shop")({ component: ShopShell });

import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "@/components/shop/cart-page";
export const Route = createFileRoute("/shop/cart")({ component: CartPage });

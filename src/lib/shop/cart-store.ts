import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./catalog";
export type CartLine = { productId: string; name: string; price: number; quantity: number };
export const useCart = create<{
  items: CartLine[];
  add: (p: Product) => boolean;
  quantity: (id: string, n: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p) => {
        const items = get().items,
          existing = items.find((i) => i.productId === p.id);
        if (
          p.stock <= 0 ||
          (existing?.quantity ?? 0) >= Math.min(p.stock, 99) ||
          (!existing && items.length >= 30)
        )
          return false;
        set({
          items: existing
            ? items.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i))
            : [...items, { productId: p.id, name: p.name, price: p.price, quantity: 1 }],
        });
        return true;
      },
      quantity: (id, n) =>
        set({
          items: get().items.map((i) =>
            i.productId === id
              ? { ...i, quantity: Math.max(1, Math.min(99, Math.floor(n) || 1)) }
              : i,
          ),
        }),
      remove: (id) => set({ items: get().items.filter((i) => i.productId !== id) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "veltshop-cart-v1",
      version: 1,
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
    },
  ),
);

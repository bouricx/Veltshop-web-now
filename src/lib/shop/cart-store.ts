import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./catalog";
export type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  markColor?: string;
};
export const useCart = create<{
  items: CartLine[];
  add: (p: Product) => boolean;
  syncProductMarks: (products: Product[]) => void;
  quantity: (id: string, n: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}>()(
  persist(
    (set, get) => ({
      items: [],
      syncProductMarks: (products) => {
        const catalog = new Map(products.map(p => [p.id,p]));
        const items = get().items;
        const next = items.map(i => {
          const p = catalog.get(i.productId);
          if (!p) return i;
          const markColor=p.cardColor ?? p.accentColor ?? "#18181b";
          return p.price !== i.price || markColor !== i.markColor ? {...i,price:p.price,markColor} : i;
        });
        if (next.some((item, index) => item !== items[index])) set({ items: next });
      },
      add: (p) => {
        const items = get().items,
          existing = items.find((i) => i.productId === p.id);
        if ((existing?.quantity ?? 0) >= 99 || (!existing && items.length >= 30)) return false;
        set({
          items: existing
            ? items.map((i) =>
                i.productId === p.id
                  ? {
                      ...i,
                      name: p.name,
                      price: p.price,
                      markColor: p.cardColor ?? p.accentColor ?? i.markColor,
                      quantity: i.quantity + 1,
                    }
                  : i,
              )
            : [
                ...items,
                {
                  productId: p.id,
                  name: p.name,
                  price: p.price,
                  quantity: 1,
                  markColor: p.cardColor ?? p.accentColor ?? "#18181b",
                },
              ],
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

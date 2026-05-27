"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;

  addItem:        (item: CartItem) => void;
  removeItem:     (productId: string, size: string, color: string | null) => void;
  updateQuantity: (productId: string, size: string, color: string | null, quantity: number) => void;
  clearCart:      () => void;
  openCart:       () => void;
  closeCart:      () => void;
  toggleCart:     () => void;
  totalItems:     () => number;
  totalPrice:     () => number;
  weightTotal:    () => number;
}

function sameItem(a: CartItem, b: { product_id: string; size: string; color: string | null }) {
  return a.product_id === b.product_id && a.size === b.size && a.color === b.color;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items:  [],
      isOpen: false,

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) => sameItem(i, newItem));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameItem(i, newItem)
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, newItem], isOpen: true };
        });
      },

      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !sameItem(i, { product_id: productId, size, color })
          ),
        }));
      },

      updateQuantity: (productId, size, color, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            sameItem(i, { product_id: productId, size, color }) ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart:  () => set({ items: [] }),
      openCart:   () => set({ isOpen: true }),
      closeCart:  () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      // Peso total en gramos (fallback 200g por unidad si el producto no tiene peso cargado)
      weightTotal: () =>
        get().items.reduce((sum, i) => sum + (i.weight_g ?? 200) * i.quantity, 0),
    }),
    {
      name:       "vl-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);

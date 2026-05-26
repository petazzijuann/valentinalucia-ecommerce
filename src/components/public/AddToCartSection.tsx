"use client";

import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { gsap } from "@/lib/gsap";
import { useCartStore } from "@/store/cart";
import type { ProductPublic, ColorVariant, StockMap } from "@/types";

// Orden de talles por categoría
const SIZE_ORDER_DEFAULT = ["ÚNICO", "XS", "S", "M", "L", "XL", "XXL"];
const PANTALON_SIZES     = ["ÚNICO", "36", "38", "40", "42", "44", "46"];

function getSizeOrder(category: string): string[] {
  return category === "pantalones" ? PANTALON_SIZES : SIZE_ORDER_DEFAULT;
}

type BtnStatus = "idle" | "loading" | "done";

interface Props {
  product:           ProductPublic;
  colorVariants?:    ColorVariant[];
  selectedColorIdx?: number;
  onColorChange?:    (idx: number) => void;
  activeStock?:      StockMap;
}

export default function AddToCartSection({
  product,
  colorVariants = [],
  selectedColorIdx = 0,
  onColorChange,
  activeStock,
}: Props) {
  const stock: StockMap = activeStock ?? (product.stock as StockMap);

  // Si hay talle ÚNICO con stock > 0, el producto es talle único
  const isUnico   = (stock["ÚNICO"] ?? 0) > 0;
  const sizeOrder = getSizeOrder(product.category);

  // Mostrar TODOS los talles presentes en el stock (sin importar si son letras o números).
  // El orden predefinido se usa para ordenarlos; los que no están en el orden van al final.
  const stockKeys    = Object.keys(stock).filter((s) => s !== "ÚNICO");
  const allSizes     = isUnico
    ? ["ÚNICO"]
    : [
        ...sizeOrder.filter((s) => stockKeys.includes(s)),
        ...stockKeys.filter((s) => !sizeOrder.includes(s)).sort(),
      ];

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity]   = useState(1);
  const [btnStatus, setBtnStatus] = useState<BtnStatus>("idle");
  const { addItem, openCart }     = useCartStore();

  const noStock = allSizes.every((s) => (stock[s] ?? 0) === 0);

  // Talle efectivo: si es ÚNICO se auto-selecciona siempre, sin necesidad de click
  const effectiveSize = isUnico ? "ÚNICO" : selectedSize;

  // Resetear talle al cambiar de color
  const [prevIdx, setPrevIdx] = useState(selectedColorIdx);
  if (prevIdx !== selectedColorIdx) {
    setPrevIdx(selectedColorIdx);
    setSelectedSize(null);
    setQuantity(1);
  }

  // Selector de color — solo si hay más de 1 variante de color real
  const showColorSelector = colorVariants.length > 1 ||
    (colorVariants.length === 1 && colorVariants[0].name !== "Único");

  function handleSizeSelect(size: string) {
    if ((stock[size] ?? 0) === 0) return;
    setSelectedSize(size);
    setQuantity(1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const el = document.getElementById(`size-btn-${product.id}-${size}`);
      if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.12, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out" });
    }
  }

  function handleAddToCart() {
    if (!effectiveSize || btnStatus !== "idle") return;
    setBtnStatus("loading");

    const activeVariant = colorVariants.length > 0 ? colorVariants[selectedColorIdx] : null;
    const cartImage     = activeVariant?.images[0] ?? product.images[0] ?? "";
    const colorName     = activeVariant && activeVariant.name !== "Único" ? activeVariant.name : null;

    setTimeout(() => {
      addItem({
        product_id: product.id,
        slug:       product.slug,
        name:       product.name,
        image:      cartImage,
        size:       effectiveSize,
        color:      colorName,
        price:      product.price_sale,
        quantity,
      });
      openCart();
      setBtnStatus("done");
      setTimeout(() => setBtnStatus("idle"), 1500);
    }, 400);
  }

  if (noStock) {
    return (
      <div className="border border-border px-6 py-4 text-center">
        <p className="label-tag text-muted-foreground">SIN STOCK</p>
      </div>
    );
  }

  const isIdle = btnStatus === "idle";

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de color */}
      {showColorSelector && colorVariants.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="label-tag">COLOR:</p>
            <p className="label-tag text-brand-green">{colorVariants[selectedColorIdx]?.name.toUpperCase()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {colorVariants.map((variant, idx) => {
              const active = selectedColorIdx === idx;
              return (
                <button
                  key={variant.name}
                  onClick={() => onColorChange?.(idx)}
                  className={`px-4 h-10 border label-tag text-sm transition-colors ${
                    active
                      ? "bg-brand-green text-brand-cream border-brand-green"
                      : "border-border hover:border-brand-green hover:bg-brand-green/5"
                  }`}
                >
                  {variant.name.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selector de talle */}
      <div>
        <div className="flex items-center mb-3">
          <p className="label-tag">TALLE</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allSizes.map((size) => {
            const qty       = stock[size] ?? 0;
            const available = qty > 0;
            const active    = effectiveSize === size;
            return (
              <button
                key={size}
                id={`size-btn-${product.id}-${size}`}
                onClick={() => handleSizeSelect(size)}
                disabled={!available}
                className={`relative border label-tag text-sm transition-colors overflow-hidden ${
                  size === "ÚNICO" ? "px-5 h-12" : "w-12 h-12"
                } ${
                  active
                    ? "bg-brand-green text-brand-cream border-brand-green"
                    : available
                    ? "border-border hover:border-brand-green hover:bg-brand-green/5"
                    : "border-border text-muted-foreground cursor-not-allowed"
                }`}
              >
                {size}
                {!available && (
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(to top right, transparent calc(50% - 1px), #d4d4cc calc(50% - 1px), #d4d4cc calc(50% + 1px), transparent calc(50% + 1px))",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de cantidad */}
      {effectiveSize && (
        <div className="flex items-center gap-4">
          <p className="label-tag">CANTIDAD</p>
          <div className="flex items-center border border-border">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-4 py-2 text-sm hover:bg-muted transition-colors"
              aria-label="Restar cantidad"
            >
              −
            </button>
            <span className="px-4 py-2 text-sm border-x border-border min-w-[3rem] text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(stock[effectiveSize] ?? 1, q + 1))}
              className="px-4 py-2 text-sm hover:bg-muted transition-colors"
              aria-label="Sumar cantidad"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Botón agregar */}
      <button
        id="add-to-cart-btn"
        onClick={handleAddToCart}
        disabled={!effectiveSize || !isIdle}
        className={`relative overflow-hidden group w-full py-4 font-bold tracking-widest text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          btnStatus === "done"
            ? "bg-green-mid text-brand-cream"
            : "bg-brand-green text-brand-cream"
        }`}
      >
        {isIdle && effectiveSize && (
          <span className="absolute inset-0 bg-brand-cream -translate-x-full group-hover:translate-x-0 transition-transform duration-100 ease-in-out" aria-hidden />
        )}
        <span className={`relative z-10 flex items-center gap-3 transition-colors duration-100 ${isIdle && effectiveSize ? "group-hover:text-brand-green" : ""}`}>
          {btnStatus === "done" ? (
            <><Check size={18} />✓ AGREGADO</>
          ) : btnStatus === "loading" ? (
            <><span className="w-4 h-4 border-2 border-brand-cream/40 border-t-brand-cream rounded-full animate-spin" />AGREGANDO...</>
          ) : (
            <><ShoppingBag size={18} />{!effectiveSize ? "ELEGÍ UN TALLE" : "AGREGAR AL CARRITO"}</>
          )}
        </span>
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import ImageGallery from "./ImageGallery";
import ProductInfoAnimated from "./ProductInfoAnimated";
import type { ProductPublic, ColorVariant, StockMap } from "@/types";

interface Props {
  product: ProductPublic;
}

export default function ProductViewWithColors({ product }: Props) {
  const colorVariants: ColorVariant[] = product.color_variants ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Si hay variantes de color, usar las del índice seleccionado;
  // si no, usar los campos legacy del producto.
  const activeImages: string[] =
    colorVariants.length > 0
      ? (colorVariants[selectedIdx]?.images ?? product.images)
      : product.images;

  const activeStock: StockMap =
    colorVariants.length > 0
      ? (colorVariants[selectedIdx]?.stock ?? (product.stock as StockMap))
      : (product.stock as StockMap);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
      {/* Galería — cambia con el color */}
      <div className="opacity-0 animate-[fadeSlideUp_0.8s_ease-out_0.1s_forwards]">
        <ImageGallery images={activeImages} name={product.name} />
      </div>

      {/* Info animada — pasa props de color */}
      <ProductInfoAnimated
        product={product}
        colorVariants={colorVariants}
        selectedColorIdx={selectedIdx}
        onColorChange={setSelectedIdx}
        activeStock={activeStock}
      />
    </div>
  );
}

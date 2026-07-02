import { prisma } from "@/lib/prisma/client";
import type { OrderItem, StockMap, ColorVariant } from "@/types";

/** ¿El producto tiene variantes de color reales (no la única "Único")? */
function hasRealColors(colorVariants: ColorVariant[]): boolean {
  return (
    colorVariants.length > 1 ||
    (colorVariants.length === 1 &&
      colorVariants[0].name.toLowerCase() !== "único")
  );
}

/**
 * Aplica un delta de stock (negativo para reservar, positivo para liberar) a
 * todos los items de un pedido, de forma atómica y consciente de las variantes
 * de color. El stock real de un producto con colores vive en `color_variants`;
 * el `stock` plano se mantiene sincronizado (igual que en la venta por Telegram).
 */
async function applyStockDelta(orderId: string, sign: 1 | -1) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const items = order.items as unknown as OrderItem[];

    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.product_id },
        select: { stock: true, color_variants: true },
      });
      if (!product) continue;

      const colorVariants =
        (product.color_variants as unknown as ColorVariant[] | null) ?? [];
      const legacyStock = { ...(product.stock as StockMap) };

      // Stock plano: siempre se mantiene en sincronía.
      legacyStock[item.size] = Math.max(
        0,
        (legacyStock[item.size] ?? 0) + sign * item.qty
      );

      // Si el producto tiene colores reales y el item trae color, descontar de
      // la variante correspondiente.
      let updatedColorVariants: ColorVariant[] | null = null;
      if (item.color && hasRealColors(colorVariants)) {
        const idx = colorVariants.findIndex(
          (v) => v.name?.toLowerCase() === item.color!.toLowerCase()
        );
        if (idx >= 0) {
          updatedColorVariants = colorVariants.map((cv, i) => {
            if (i !== idx) return cv;
            return {
              ...cv,
              stock: {
                ...cv.stock,
                [item.size]: Math.max(
                  0,
                  (cv.stock[item.size] ?? 0) + sign * item.qty
                ),
              },
            };
          });
        }
      }

      await tx.product.update({
        where: { id: item.product_id },
        data: {
          stock: legacyStock,
          ...(updatedColorVariants && {
            color_variants: JSON.parse(JSON.stringify(updatedColorVariants)),
          }),
        },
      });
    }
  });
}

export async function reserveStock(orderId: string) {
  await applyStockDelta(orderId, -1);
}

export async function releaseStockQuantities(orderId: string) {
  await applyStockDelta(orderId, 1);
}

export async function fulfillOrder(orderId: string, paymentMethod: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === "payment_confirmed") return;

  const items = order.items as unknown as OrderItem[];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      select: { price_cost: true },
    });
    if (!product) continue;
    await prisma.sale.create({
      data: {
        product_id:     item.product_id,
        product_name:   item.name,
        size:           item.size,
        quantity:       item.qty,
        sale_price:     item.price,
        cost_price:     product.price_cost,
        channel:        "online",
        payment_method: paymentMethod,
        order_id:       orderId,
      },
    });
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "payment_confirmed" } });

  // TODO: crear orden en Envia.com cuando se confirma el pago
  // Guardar result.trackingId → carrier_tracking_id, result.orderId → carrier_order_id
}

export async function releaseStock(orderId: string) {
  await releaseStockQuantities(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
}

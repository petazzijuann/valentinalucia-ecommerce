import { prisma } from "@/lib/prisma/client";
import type { OrderItem, StockMap } from "@/types";

export async function reserveStock(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const items = order.items as unknown as OrderItem[];
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      select: { stock: true },
    });
    if (!product) continue;
    const stock = product.stock as StockMap;
    stock[item.size] = Math.max(0, (stock[item.size] ?? 0) - item.qty);
    await prisma.product.update({ where: { id: item.product_id }, data: { stock } });
  }
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
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const items = order.items as unknown as OrderItem[];
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      select: { stock: true },
    });
    if (!product) continue;
    const stock = product.stock as StockMap;
    stock[item.size] = (stock[item.size] ?? 0) + item.qty;
    await prisma.product.update({ where: { id: item.product_id }, data: { stock } });
  }
  await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
}

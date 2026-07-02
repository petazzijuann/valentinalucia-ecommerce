import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";

const schema = z.object({
  payment_proof_url: z.string().url(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Solo se acepta el comprobante mientras el pedido siga pendiente de pago.
  // NO se confirma el pago acá: la confirmación la hace el admin tras verificar
  // la transferencia (POST /api/admin/orders/[id] action=confirm). De lo
  // contrario cualquiera podría marcar su pedido como pagado subiendo una imagen.
  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Este pedido ya no admite comprobantes" },
      { status: 409 }
    );
  }

  await prisma.order.update({
    where: { id },
    data: { payment_proof_url: parsed.data.payment_proof_url },
  });

  return NextResponse.json({ ok: true });
}

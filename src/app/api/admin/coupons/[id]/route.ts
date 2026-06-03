import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";

const patchSchema = z.object({
  code:         z.string().min(1).regex(/^[A-Z0-9]+$/, "Solo letras y números"),
  type:         z.enum(["percent", "fixed", "free_shipping"]),
  value:        z.number().positive().nullable().optional(),
  stock:        z.number().int().min(1),
  min_purchase: z.number().positive().nullable().optional(),
  expires_at:   z.string().nullable().optional(),
  is_active:    z.boolean(),
}).superRefine((data, ctx) => {
  if (data.type === "percent") {
    if (!data.value || data.value < 1 || data.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "El porcentaje debe ser entre 1 y 100" });
    }
  }
  if (data.type === "fixed") {
    if (!data.value || data.value <= 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "El valor debe ser mayor a 0" });
    }
  }
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { code, type, value, stock, min_purchase, expires_at, is_active } = parsed.data;
  const normalizedCode = code.toUpperCase();

  const existing = await prisma.coupon.findFirst({
    where: { code: normalizedCode, NOT: { id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un cupón con ese código" }, { status: 409 });
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code:         normalizedCode,
      type,
      value:        type === "free_shipping" ? null : (value ?? null),
      stock,
      min_purchase: min_purchase ?? null,
      expires_at:   expires_at ? new Date(expires_at) : null,
      is_active,
    },
  });

  return NextResponse.json({
    ...coupon,
    value:        coupon.value        !== null ? Number(coupon.value)        : null,
    min_purchase: coupon.min_purchase !== null ? Number(coupon.min_purchase) : null,
    expires_at:   coupon.expires_at   ? coupon.expires_at.toISOString()      : null,
    created_at:   coupon.created_at.toISOString(),
    updated_at:   coupon.updated_at.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (coupon.used_count > 0) {
    return NextResponse.json(
      { error: "Este cupón fue utilizado en pedidos y no puede eliminarse" },
      { status: 409 }
    );
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/lib/auth/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const { description, amount, date, category, notes } = body;

  if (description !== undefined && !description?.trim()) {
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  }
  if (amount !== undefined) {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(description !== undefined && { description: description.trim() }),
      ...(amount      !== undefined && { amount: parseFloat(amount) }),
      ...(date        !== undefined && { date: new Date(date) }),
      ...(category    !== undefined && { category: category?.trim() || null }),
      ...(notes       !== undefined && { notes: notes?.trim() || null }),
    },
  });

  return NextResponse.json({
    id:          expense.id,
    description: expense.description,
    amount:      Number(expense.amount),
    date:        expense.date.toISOString(),
    category:    expense.category,
    notes:       expense.notes,
    created_at:  expense.created_at.toISOString(),
    updated_at:  expense.updated_at.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await prisma.expense.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

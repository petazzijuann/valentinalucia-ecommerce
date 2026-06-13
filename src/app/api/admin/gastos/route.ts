import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
  });

  return NextResponse.json(
    expenses.map((e) => ({
      id:          e.id,
      description: e.description,
      amount:      Number(e.amount),
      date:        e.date.toISOString(),
      category:    e.category,
      notes:       e.notes,
      created_at:  e.created_at.toISOString(),
      updated_at:  e.updated_at.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { description, amount, date, category, notes } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      description: description.trim(),
      amount:      amt,
      date:        date ? new Date(date) : new Date(),
      category:    category?.trim() || null,
      notes:       notes?.trim() || null,
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
  }, { status: 201 });
}

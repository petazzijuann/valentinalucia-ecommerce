import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/lib/auth/admin";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const format = request.nextUrl.searchParams.get("format");

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { created_at: "desc" },
  });

  if (format === "csv") {
    // Neutraliza inyección de fórmulas: emails que empiezan con = + - @ podrían
    // ejecutarse como fórmula en Excel/Sheets.
    const csvCell = (v: string) =>
      `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
    const rows = subscribers.map((s) =>
      `${csvCell(s.email)},${s.created_at.toISOString().slice(0, 10)}`
    );
    const csv = ["email,fecha", ...rows].join("\n");
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="VALENTINA LUCIA-suscriptores-${date}.csv"`,
      },
    });
  }

  return NextResponse.json(
    subscribers.map((s) => ({ ...s, created_at: s.created_at.toISOString() }))
  );
}

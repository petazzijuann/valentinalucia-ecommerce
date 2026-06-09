import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const players = await prisma.prodePlayer.findMany({
    where: { submitted_at: { not: null } },
    orderBy: [{ total_points: "desc" }, { submitted_at: "asc" }],
    select: { instagram: true, total_points: true },
  });

  return NextResponse.json({ players });
}

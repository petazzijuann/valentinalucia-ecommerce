import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getProdeSettings } from "@/lib/prode/settings";
import { recalcAll } from "@/lib/prode/scoring";
import { requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [matches, settings, playerCount] = await Promise.all([
    prisma.prodeMatch.findMany({ orderBy: { code: "asc" } }),
    getProdeSettings(),
    prisma.prodePlayer.count({ where: { submitted_at: { not: null } } }),
  ]);

  return NextResponse.json({
    matches,
    locked: settings.predictions_locked,
    playerCount,
  });
}

const postSchema = z.object({
  matches: z.array(
    z.object({
      id: z.string().min(1),
      home_score: z.number().int().min(0).max(99).nullable(),
      away_score: z.number().int().min(0).max(99).nullable(),
      finished: z.boolean(),
    }),
  ),
  predictions_locked: z.boolean(),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { matches, predictions_locked } = parsed.data;

  await prisma.$transaction([
    ...matches.map((m) =>
      prisma.prodeMatch.update({
        where: { id: m.id },
        data: {
          // Solo se marca finished si hay ambos marcadores cargados.
          home_score: m.home_score,
          away_score: m.away_score,
          finished: m.finished && m.home_score !== null && m.away_score !== null,
        },
      }),
    ),
    prisma.prodeSettings.upsert({
      where: { id: "main" },
      update: { predictions_locked },
      create: { id: "main", predictions_locked },
    }),
  ]);

  await recalcAll();

  return NextResponse.json({ ok: true });
}

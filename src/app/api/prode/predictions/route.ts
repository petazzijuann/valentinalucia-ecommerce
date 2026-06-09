import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getSessionPlayer } from "@/lib/prode/auth";
import { getProdeSettings } from "@/lib/prode/settings";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [matches, settings, mine] = await Promise.all([
    prisma.prodeMatch.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, group: true, home_team: true, away_team: true },
    }),
    getProdeSettings(),
    prisma.prodeMatchPrediction.findMany({ where: { player_id: player.id } }),
  ]);

  const scores: Record<string, { home: number; away: number }> = {};
  for (const p of mine) {
    scores[p.match_id] = { home: p.home_score, away: p.away_score };
  }

  return NextResponse.json({
    matches,
    locked: settings.predictions_locked,
    mine: {
      submitted: player.submitted_at !== null,
      scores,
    },
  });
}

const scoreSchema = z.object({
  home: z.number().int().min(0).max(99),
  away: z.number().int().min(0).max(99),
});

const postSchema = z.object({
  scores: z.record(z.string(), scoreSchema),
});

export async function POST(request: NextRequest) {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const settings = await getProdeSettings();
  if (settings.predictions_locked) {
    return NextResponse.json({ error: "Los pronósticos están cerrados" }, { status: 403 });
  }
  if (player.submitted_at !== null) {
    return NextResponse.json({ error: "Ya enviaste tus pronósticos" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const matches = await prisma.prodeMatch.findMany({ select: { id: true } });
  const { scores } = parsed.data;

  // Exigir marcador para todos los partidos.
  for (const m of matches) {
    if (!scores[m.id]) {
      return NextResponse.json(
        { error: "Faltan completar partidos" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.prodeMatchPrediction.createMany({
      data: matches.map((m) => ({
        player_id: player.id,
        match_id: m.id,
        home_score: scores[m.id].home,
        away_score: scores[m.id].away,
      })),
    }),
    prisma.prodePlayer.update({
      where: { id: player.id },
      data: { submitted_at: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}

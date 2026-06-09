import { prisma } from "@/lib/prisma/client";

export const POINTS = { exactScore: 5, outcome: 2 } as const;

interface ScoreInput {
  home_score: number;
  away_score: number;
}

interface MatchResult {
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
}

const sign = (a: number, b: number) => Math.sign(a - b);

/** Puntaje de una predicción contra el resultado real del partido. */
export function scoreMatch(pred: ScoreInput, match: MatchResult): number {
  if (!match.finished || match.home_score === null || match.away_score === null) {
    return 0;
  }
  if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
    return POINTS.exactScore;
  }
  if (sign(pred.home_score, pred.away_score) === sign(match.home_score, match.away_score)) {
    return POINTS.outcome;
  }
  return 0;
}

/**
 * Recalcula los puntos de todas las predicciones y el total de cada jugador.
 * Se ejecuta tras cargar/editar resultados en el admin.
 */
export async function recalcAll(): Promise<void> {
  const [matches, predictions] = await Promise.all([
    prisma.prodeMatch.findMany(),
    prisma.prodeMatchPrediction.findMany(),
  ]);

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const totals = new Map<string, number>();

  const updates = predictions.map((p) => {
    const match = matchById.get(p.match_id);
    const points = match ? scoreMatch(p, match) : 0;
    totals.set(p.player_id, (totals.get(p.player_id) ?? 0) + points);
    return prisma.prodeMatchPrediction.update({
      where: { id: p.id },
      data: { points },
    });
  });

  // Resetear a 0 a quienes no tengan predicciones también.
  const players = await prisma.prodePlayer.findMany({ select: { id: true } });
  const playerUpdates = players.map((pl) =>
    prisma.prodePlayer.update({
      where: { id: pl.id },
      data: { total_points: totals.get(pl.id) ?? 0 },
    }),
  );

  await prisma.$transaction([...updates, ...playerUpdates]);
}

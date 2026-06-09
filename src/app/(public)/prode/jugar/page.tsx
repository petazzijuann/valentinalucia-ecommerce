import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getSessionPlayer } from "@/lib/prode/auth";
import { getProdeSettings } from "@/lib/prode/settings";
import ProdeForm from "@/components/prode/ProdeForm";
import LogoutButton from "@/components/prode/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prode — Mis pronósticos",
};

export default async function ProdeJugarPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/prode/login");

  const [matches, settings, mine] = await Promise.all([
    prisma.prodeMatch.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, group: true, home_team: true, away_team: true },
    }),
    getProdeSettings(),
    prisma.prodeMatchPrediction.findMany({ where: { player_id: player.id } }),
  ]);

  const initialScores: Record<string, { home: number; away: number }> = {};
  for (const p of mine) {
    initialScores[p.match_id] = { home: p.home_score, away: p.away_score };
  }

  return (
    <div className="bg-background">
      <div className="bg-brand-green text-brand-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/prode" className="label-tag text-cream-dark text-[10px] hover:text-brand-cream">
              ← VOLVER AL PRODE
            </Link>
            <h1 className="font-bebas text-3xl tracking-widest mt-1">MIS PRONÓSTICOS</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="label-tag text-[11px] text-cream-dark">@{player.instagram}</p>
            <LogoutButton className="mt-1" />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {matches.length === 0 ? (
          <p className="label-tag text-muted-foreground text-center text-xs py-12">
            Todavía no se cargaron los partidos. Volvé más tarde.
          </p>
        ) : (
          <ProdeForm
            matches={matches}
            initialScores={initialScores}
            submitted={player.submitted_at !== null}
            locked={settings.predictions_locked}
          />
        )}
      </div>
    </div>
  );
}

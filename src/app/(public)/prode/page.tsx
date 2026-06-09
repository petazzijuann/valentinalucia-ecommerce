import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { getSessionPlayer } from "@/lib/prode/auth";
import { TEAMS, GROUPS } from "@/data/torneo";
import TeamFlag from "@/components/prode/TeamFlag";
import RankingTable from "@/components/prode/RankingTable";
import LogoutButton from "@/components/prode/LogoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prode — Fase de grupos",
  description:
    "Pronosticá los resultados de la fase de grupos y competí por el primer puesto del ranking.",
};

export default async function ProdePage() {
  const player = await getSessionPlayer();

  const players = await prisma.prodePlayer
    .findMany({
      where: { submitted_at: { not: null } },
      orderBy: [{ total_points: "desc" }, { submitted_at: "asc" }],
      select: { instagram: true, total_points: true },
    })
    .catch(() => []);

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="bg-brand-green text-brand-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="label-tag text-cream-dark text-[11px] tracking-widest">VALENTINA LUCIA</p>
          <h1 className="font-bebas text-[clamp(48px,10vw,96px)] leading-none tracking-widest mt-2">
            PRODE · FASE DE GRUPOS
          </h1>
          <p className="text-cream-dark max-w-xl mx-auto mt-4 text-sm">
            Pronosticá el resultado exacto de cada partido de la fase de grupos.
            Sumás puntos por cada acierto y competís por el primer puesto del ranking.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {player ? (
              <>
                <Link
                  href="/prode/jugar"
                  className="bg-brand-cream text-brand-green px-8 py-3.5 font-bold tracking-widest text-sm hover:bg-white transition-colors"
                >
                  {player.submitted_at ? "VER MIS PRONÓSTICOS" : "JUGAR AHORA"}
                </Link>
                <span className="label-tag text-cream-dark text-[11px]">@{player.instagram}</span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/prode/registro"
                  className="bg-brand-cream text-brand-green px-8 py-3.5 font-bold tracking-widest text-sm hover:bg-white transition-colors"
                >
                  REGISTRARME
                </Link>
                <Link
                  href="/prode/login"
                  className="border border-cream-dark/40 px-8 py-3.5 font-bold tracking-widest text-sm hover:border-brand-cream transition-colors"
                >
                  INGRESAR
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Cómo se puntúa */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-bebas text-3xl text-brand-green tracking-widest text-center mb-8">
          CÓMO SE PUNTÚA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="border border-border p-8 text-center">
            <p className="font-bebas text-6xl text-brand-green">+5</p>
            <p className="label-tag text-xs mt-2">RESULTADO EXACTO</p>
            <p className="text-muted-foreground text-xs mt-2">
              Acertás el marcador justo del partido.
            </p>
          </div>
          <div className="border border-border p-8 text-center">
            <p className="font-bebas text-6xl text-brand-green">+2</p>
            <p className="label-tag text-xs mt-2">ACIERTO DE GANADOR</p>
            <p className="text-muted-foreground text-xs mt-2">
              Acertás quién gana (o el empate), pero no el marcador.
            </p>
          </div>
        </div>
      </section>

      {/* Grupos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="font-bebas text-3xl text-brand-green tracking-widest text-center mb-8">
          LOS GRUPOS
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GROUPS.map((group) => (
            <div key={group} className="border border-border">
              <div className="bg-brand-green text-brand-cream px-4 py-2">
                <p className="font-bebas text-lg tracking-widest">GRUPO {group}</p>
              </div>
              <ul className="divide-y divide-border">
                {TEAMS.filter((t) => t.group === group).map((t) => (
                  <li key={t.code} className="px-4 py-2.5 text-sm">
                    <TeamFlag code={t.code} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Ranking */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-bebas text-3xl text-brand-green tracking-widest text-center mb-8">
          RANKING
        </h2>
        <RankingTable players={players} />
      </section>
    </div>
  );
}

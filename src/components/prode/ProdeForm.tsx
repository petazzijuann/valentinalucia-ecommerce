"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TeamFlag from "@/components/prode/TeamFlag";

export interface ProdeMatchView {
  id: string;
  code: string;
  group: string;
  home_team: string;
  away_team: string;
}

type ScoreMap = Record<string, { home: string; away: string }>;

export default function ProdeForm({
  matches,
  initialScores,
  submitted,
  locked,
}: {
  matches: ProdeMatchView[];
  initialScores: Record<string, { home: number; away: number }>;
  submitted: boolean;
  locked: boolean;
}) {
  const router = useRouter();

  const readOnly = submitted || locked;

  const [scores, setScores] = useState<ScoreMap>(() => {
    const init: ScoreMap = {};
    for (const m of matches) {
      const existing = initialScores[m.id];
      init[m.id] = existing
        ? { home: String(existing.home), away: String(existing.away) }
        : { home: "", away: "" };
    }
    return init;
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => {
    const byGroup = new Map<string, ProdeMatchView[]>();
    for (const m of matches) {
      const arr = byGroup.get(m.group) ?? [];
      arr.push(m);
      byGroup.set(m.group, arr);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  function setScore(id: string, side: "home" | "away", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setScores((s) => ({ ...s, [id]: { ...s[id], [side]: clean } }));
  }

  async function handleSubmit() {
    setError("");
    const payload: Record<string, { home: number; away: number }> = {};
    for (const m of matches) {
      const s = scores[m.id];
      if (s.home === "" || s.away === "") {
        setError("Completá el marcador de todos los partidos.");
        return;
      }
      payload[m.id] = { home: Number(s.home), away: Number(s.away) };
    }

    setLoading(true);
    const res = await fetch("/api/prode/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: payload }),
    });

    if (res.ok) {
      router.refresh();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "No se pudo enviar. Intentá de nuevo.");
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {readOnly && (
        <div className="mb-8 border border-green-mid bg-green-mid/30 px-5 py-4 text-center">
          <p className="label-tag text-brand-cream text-xs">
            {submitted
              ? "✓ Ya enviaste tus pronósticos. No se pueden modificar."
              : "Los pronósticos están cerrados."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-10">
        {groups.map(([group, gms]) => (
          <section key={group}>
            <h2 className="font-bebas text-2xl text-brand-green tracking-widest mb-4 border-b border-border pb-2">
              GRUPO {group}
            </h2>
            <div className="flex flex-col divide-y divide-border">
              {gms.map((m) => {
                const s = scores[m.id];
                return (
                  <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3">
                    <div className="justify-self-end text-right text-sm">
                      <TeamFlag code={m.home_team} className="flex-row-reverse text-right" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        inputMode="numeric"
                        value={s.home}
                        onChange={(e) => setScore(m.id, "home", e.target.value)}
                        disabled={readOnly}
                        aria-label={`Goles ${m.home_team}`}
                        className="w-11 h-11 text-center border border-border text-base font-semibold focus:outline-none focus:border-brand-green disabled:bg-muted disabled:text-muted-foreground"
                      />
                      <span className="text-muted-foreground text-xs">vs</span>
                      <input
                        inputMode="numeric"
                        value={s.away}
                        onChange={(e) => setScore(m.id, "away", e.target.value)}
                        disabled={readOnly}
                        aria-label={`Goles ${m.away_team}`}
                        className="w-11 h-11 text-center border border-border text-base font-semibold focus:outline-none focus:border-brand-green disabled:bg-muted disabled:text-muted-foreground"
                      />
                    </div>
                    <div className="justify-self-start text-left text-sm">
                      <TeamFlag code={m.away_team} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-10 sticky bottom-4">
          {error && <p className="label-tag text-red-600 text-xs mb-3 text-center">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-brand-green text-brand-cream font-bold tracking-widest text-sm hover:bg-green-dark transition-colors disabled:opacity-50"
          >
            {loading ? "ENVIANDO..." : "ENVIAR PRONÓSTICOS"}
          </button>
          <p className="text-center label-tag text-muted-foreground text-[10px] mt-2">
            Una vez enviados no se pueden modificar.
          </p>
        </div>
      )}
    </div>
  );
}

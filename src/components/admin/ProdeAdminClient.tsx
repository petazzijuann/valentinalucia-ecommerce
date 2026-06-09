"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Check, Lock, Unlock } from "lucide-react";
import TeamFlag from "@/components/prode/TeamFlag";

interface MatchRow {
  id: string;
  code: string;
  group: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
}

interface EditState {
  home: string;
  away: string;
  finished: boolean;
}

export default function ProdeAdminClient() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [locked, setLocked] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/admin/prode");
    const data = (await res.json()) as {
      matches: MatchRow[];
      locked: boolean;
      playerCount: number;
    };
    setMatches(data.matches);
    setLocked(data.locked);
    setPlayerCount(data.playerCount);
    const init: Record<string, EditState> = {};
    for (const m of data.matches) {
      init[m.id] = {
        home: m.home_score !== null ? String(m.home_score) : "",
        away: m.away_score !== null ? String(m.away_score) : "",
        finished: m.finished,
      };
    }
    setEdits(init);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const byGroup = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const arr = byGroup.get(m.group) ?? [];
      arr.push(m);
      byGroup.set(m.group, arr);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  function setScore(id: string, side: "home" | "away", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setEdits((e) => ({ ...e, [id]: { ...e[id], [side]: clean } }));
  }

  function toggleFinished(id: string) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], finished: !e[id].finished } }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const payload = {
      matches: matches.map((m) => {
        const e = edits[m.id];
        return {
          id: m.id,
          home_score: e.home === "" ? null : Number(e.home),
          away_score: e.away === "" ? null : Number(e.away),
          finished: e.finished,
        };
      }),
      predictions_locked: locked,
    };

    const res = await fetch("/api/admin/prode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage("✓ Guardado y ranking recalculado.");
      await load();
    } else {
      setMessage("Error al guardar. Revisá los datos.");
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="label-tag text-muted-foreground text-xs">Cargando…</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-bebas text-3xl text-foreground tracking-widest flex items-center gap-2">
            <Trophy size={24} /> PRODE
          </h1>
          <p className="label-tag text-muted-foreground text-[11px] mt-1">
            {playerCount} jugador{playerCount === 1 ? "" : "es"} con pronósticos enviados
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-green text-brand-cream px-6 py-3 font-bold tracking-widest text-xs hover:bg-green-dark transition-colors disabled:opacity-50"
        >
          {saving ? "GUARDANDO…" : "GUARDAR Y RECALCULAR"}
        </button>
      </div>

      {/* Toggle cerrar pronósticos */}
      <div className="border border-border p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="label-tag text-xs flex items-center gap-2">
            {locked ? <Lock size={14} /> : <Unlock size={14} />}
            PRONÓSTICOS {locked ? "CERRADOS" : "ABIERTOS"}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {locked
              ? "Los jugadores no pueden enviar nuevos pronósticos."
              : "Los jugadores todavía pueden registrarse y enviar."}
          </p>
        </div>
        <button
          onClick={() => setLocked((v) => !v)}
          className={`px-5 py-2.5 font-bold tracking-widest text-xs transition-colors ${
            locked
              ? "bg-green-mid text-brand-cream hover:bg-green-dark"
              : "border border-border hover:border-brand-green"
          }`}
        >
          {locked ? "REABRIR" : "CERRAR"}
        </button>
      </div>

      {message && (
        <p className="label-tag text-xs mb-4 text-brand-green">{message}</p>
      )}

      {/* Partidos por grupo */}
      <div className="flex flex-col gap-8">
        {groups.map(([group, gms]) => (
          <section key={group}>
            <h2 className="font-bebas text-xl text-foreground tracking-widest mb-3 border-b border-border pb-1">
              GRUPO {group}
            </h2>
            <div className="flex flex-col divide-y divide-border">
              {gms.map((m) => {
                const e = edits[m.id];
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[2.5rem_1fr_auto_1fr_auto] items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="label-tag text-[10px] text-muted-foreground">{m.code}</span>
                    <div className="justify-self-end text-right">
                      <TeamFlag code={m.home_team} className="flex-row-reverse" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        inputMode="numeric"
                        value={e.home}
                        onChange={(ev) => setScore(m.id, "home", ev.target.value)}
                        className="w-10 h-9 text-center border border-border focus:outline-none focus:border-brand-green"
                      />
                      <span className="text-muted-foreground text-xs">-</span>
                      <input
                        inputMode="numeric"
                        value={e.away}
                        onChange={(ev) => setScore(m.id, "away", ev.target.value)}
                        className="w-10 h-9 text-center border border-border focus:outline-none focus:border-brand-green"
                      />
                    </div>
                    <div className="justify-self-start">
                      <TeamFlag code={m.away_team} />
                    </div>
                    <button
                      onClick={() => toggleFinished(m.id)}
                      title="Marcar partido como finalizado"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold tracking-widest transition-colors ${
                        e.finished
                          ? "bg-brand-green text-brand-cream"
                          : "border border-border text-muted-foreground hover:border-brand-green"
                      }`}
                    >
                      <Check size={12} /> FIN
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

interface RankingRow {
  instagram: string;
  total_points: number;
}

export default function RankingTable({ players }: { players: RankingRow[] }) {
  if (players.length === 0) {
    return (
      <p className="label-tag text-muted-foreground text-xs text-center py-8">
        Todavía no hay jugadores en el ranking. ¡Sé el primero!
      </p>
    );
  }

  return (
    <div className="overflow-hidden border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-green text-brand-cream">
            <th className="label-tag text-[10px] text-left px-4 py-3 w-12">#</th>
            <th className="label-tag text-[10px] text-left px-4 py-3">JUGADOR</th>
            <th className="label-tag text-[10px] text-right px-4 py-3 w-24">PUNTOS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {players.map((p, i) => (
            <tr key={p.instagram} className={i % 2 === 0 ? "bg-white" : "bg-muted/40"}>
              <td className="px-4 py-3 font-semibold text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3">@{p.instagram}</td>
              <td className="px-4 py-3 text-right font-bebas text-lg text-brand-green">
                {p.total_points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

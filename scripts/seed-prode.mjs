/**
 * Seed del Prode: inserta los partidos de la fase de grupos y la fila singleton
 * de settings. Idempotente — se puede correr varias veces (ON CONFLICT DO NOTHING).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-prode.mjs
 *
 * Lee DATABASE_URL de .env.local.
 *
 * ⚠️ Este script duplica los datos de equipos de src/data/torneo.ts (no puede
 * importar TS directamente). Si editás los grupos/equipos allá, actualizá también
 * el array TEAMS de abajo y volvé a correr el seed.
 */

import { randomUUID } from "node:crypto";
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en el entorno (.env.local).");
  process.exit(1);
}

// ── Equipos (debe coincidir con src/data/torneo.ts) ─────────────
const TEAMS = [
  { code: "mx", group: "A" }, { code: "hr", group: "A" }, { code: "no", group: "A" }, { code: "jo", group: "A" },
  { code: "ca", group: "B" }, { code: "ma", group: "B" }, { code: "pa", group: "B" }, { code: "uz", group: "B" },
  { code: "es", group: "C" }, { code: "co", group: "C" }, { code: "eg", group: "C" }, { code: "ht", group: "C" },
  { code: "us", group: "D" }, { code: "uy", group: "D" }, { code: "dz", group: "D" }, { code: "nz", group: "D" },
  { code: "ar", group: "E" }, { code: "ch", group: "E" }, { code: "gb-sct", group: "E" }, { code: "cw", group: "E" },
  { code: "fr", group: "F" }, { code: "jp", group: "F" }, { code: "py", group: "F" }, { code: "gh", group: "F" },
  { code: "gb-eng", group: "G" }, { code: "sn", group: "G" }, { code: "tn", group: "G" }, { code: "hn", group: "G" },
  { code: "br", group: "H" }, { code: "ir", group: "H" }, { code: "ci", group: "H" }, { code: "cr", group: "H" },
  { code: "pt", group: "I" }, { code: "kr", group: "I" }, { code: "qa", group: "I" }, { code: "rp-uefa-a", group: "I" },
  { code: "nl", group: "J" }, { code: "ec", group: "J" }, { code: "sa", group: "J" }, { code: "rp-uefa-b", group: "J" },
  { code: "be", group: "K" }, { code: "at", group: "K" }, { code: "za", group: "K" }, { code: "rp-ic-1", group: "K" },
  { code: "de", group: "L" }, { code: "au", group: "L" }, { code: "cv", group: "L" }, { code: "rp-ic-2", group: "L" },
];

const PAIR_ORDER = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

const GROUPS = [...new Set(TEAMS.map((t) => t.group))];

const FIXTURE = GROUPS.flatMap((group) => {
  const teams = TEAMS.filter((t) => t.group === group);
  return PAIR_ORDER.map(([h, a], i) => ({
    code: `${group}${i + 1}`,
    group,
    home_team: teams[h].code,
    away_team: teams[a].code,
  }));
});

// ── Inserción ───────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });

try {
  let inserted = 0;
  for (const m of FIXTURE) {
    const res = await pool.query(
      `INSERT INTO prode_matches (id, code, "group", home_team, away_team, finished)
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (code) DO NOTHING`,
      [randomUUID(), m.code, m.group, m.home_team, m.away_team],
    );
    inserted += res.rowCount ?? 0;
  }

  await pool.query(
    `INSERT INTO prode_settings (id, predictions_locked, updated_at)
     VALUES ('main', false, now())
     ON CONFLICT (id) DO NOTHING`,
  );

  console.log(`✅ Seed completo: ${FIXTURE.length} partidos en el fixture, ${inserted} nuevos insertados.`);
  console.log("   Settings 'main' asegurado.");
} catch (err) {
  console.error("❌ Error en el seed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

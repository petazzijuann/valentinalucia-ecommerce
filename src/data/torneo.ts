/**
 * Datos del torneo — fase de grupos (formato Mundial 2026).
 * 12 grupos (A–L) de 4 selecciones = 48 equipos · 6 partidos por grupo = 72 partidos.
 *
 * ⚠️ VERIFICAR contra el sorteo oficial: el reparto de selecciones por grupo
 * que sigue es un punto de partida editable. Ajustá `name`, `code` (ISO2 para la
 * bandera) y `group` según el sorteo definitivo. Las plazas de repechaje todavía
 * sin definir están marcadas como placeholders (code "xx").
 *
 * `code` = ISO alpha-2 en minúscula para flagcdn. Para selecciones del Reino Unido
 * se usan los subcódigos que soporta flagcdn: "gb-eng" (Inglaterra), "gb-sct"
 * (Escocia), "gb-wls" (Gales).
 */

export interface Team {
  code: string; // ISO2 (o gb-eng / gb-sct / gb-wls), o "xx" para placeholder
  name: string;
  group: string; // "A".."L"
}

export interface Match {
  code: string; // "A1".."L6"
  group: string;
  home_team: string; // code del equipo local
  away_team: string; // code del equipo visitante
}

/**
 * 48 selecciones repartidas en 12 grupos.
 * Anfitriones según el sorteo: México (A), Canadá (B), EE. UU. (D).
 */
export const TEAMS: Team[] = [
  // Grupo A
  { code: "mx", name: "México", group: "A" },
  { code: "hr", name: "Croacia", group: "A" },
  { code: "no", name: "Noruega", group: "A" },
  { code: "jo", name: "Jordania", group: "A" },
  // Grupo B
  { code: "ca", name: "Canadá", group: "B" },
  { code: "ma", name: "Marruecos", group: "B" },
  { code: "pa", name: "Panamá", group: "B" },
  { code: "uz", name: "Uzbekistán", group: "B" },
  // Grupo C
  { code: "es", name: "España", group: "C" },
  { code: "co", name: "Colombia", group: "C" },
  { code: "eg", name: "Egipto", group: "C" },
  { code: "ht", name: "Haití", group: "C" },
  // Grupo D
  { code: "us", name: "Estados Unidos", group: "D" },
  { code: "uy", name: "Uruguay", group: "D" },
  { code: "dz", name: "Argelia", group: "D" },
  { code: "nz", name: "Nueva Zelanda", group: "D" },
  // Grupo E
  { code: "ar", name: "Argentina", group: "E" },
  { code: "ch", name: "Suiza", group: "E" },
  { code: "gb-sct", name: "Escocia", group: "E" },
  { code: "cw", name: "Curazao", group: "E" },
  // Grupo F
  { code: "fr", name: "Francia", group: "F" },
  { code: "jp", name: "Japón", group: "F" },
  { code: "py", name: "Paraguay", group: "F" },
  { code: "gh", name: "Ghana", group: "F" },
  // Grupo G
  { code: "gb-eng", name: "Inglaterra", group: "G" },
  { code: "sn", name: "Senegal", group: "G" },
  { code: "tn", name: "Túnez", group: "G" },
  { code: "hn", name: "Honduras", group: "G" },
  // Grupo H
  { code: "br", name: "Brasil", group: "H" },
  { code: "ir", name: "Irán", group: "H" },
  { code: "ci", name: "Costa de Marfil", group: "H" },
  { code: "cr", name: "Costa Rica", group: "H" },
  // Grupo I
  { code: "pt", name: "Portugal", group: "I" },
  { code: "kr", name: "Corea del Sur", group: "I" },
  { code: "qa", name: "Catar", group: "I" },
  { code: "rp-uefa-a", name: "Repechaje UEFA A", group: "I" },
  // Grupo J
  { code: "nl", name: "Países Bajos", group: "J" },
  { code: "ec", name: "Ecuador", group: "J" },
  { code: "sa", name: "Arabia Saudita", group: "J" },
  { code: "rp-uefa-b", name: "Repechaje UEFA B", group: "J" },
  // Grupo K
  { code: "be", name: "Bélgica", group: "K" },
  { code: "at", name: "Austria", group: "K" },
  { code: "za", name: "Sudáfrica", group: "K" },
  { code: "rp-ic-1", name: "Repechaje Intercontinental 1", group: "K" },
  // Grupo L
  { code: "de", name: "Alemania", group: "L" },
  { code: "au", name: "Australia", group: "L" },
  { code: "cv", name: "Cabo Verde", group: "L" },
  { code: "rp-ic-2", name: "Repechaje Intercontinental 2", group: "L" },
];

/** Lista de grupos en orden, derivada de TEAMS. */
export const GROUPS: string[] = [...new Set(TEAMS.map((t) => t.group))];

/**
 * Orden de emparejamiento round-robin para un grupo de 4 (índices dentro del grupo):
 * (0-1), (2-3), (0-2), (1-3), (0-3), (1-2)
 */
const PAIR_ORDER: Array<[number, number]> = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

/**
 * FIXTURE: 6 partidos por grupo. `code` = `${grupo}${i+1}` (ej. "A1".."A6").
 * El equipo en la posición par del par es local.
 */
export const FIXTURE: Match[] = GROUPS.flatMap((group) => {
  const teams = TEAMS.filter((t) => t.group === group);
  return PAIR_ORDER.map(([h, a], i) => ({
    code: `${group}${i + 1}`,
    group,
    home_team: teams[h].code,
    away_team: teams[a].code,
  }));
});

const TEAM_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

/** Devuelve el equipo por su código (o undefined si es un placeholder/desconocido). */
export function teamByCode(code: string): Team | undefined {
  return TEAM_BY_CODE.get(code);
}

/** URL de la bandera en flagcdn. `size` es el ancho (px) del PNG. */
export function flagUrl(code: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${code}.png`;
}

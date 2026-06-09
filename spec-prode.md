# Mini-spec: Prode "solo fase de grupos"

## 1. Alcance

- Sub-página propia (`/prode`) enlazada desde el header.
- Registro/login propio (separado de cualquier admin existente): Instagram (único, una vez) + email + contraseña. El email se copia a la lista de suscriptores (`Subscriber`).
- Pronóstico de resultado exacto de cada partido de fase de grupos.
- Ranking automático con puntajes.
- Panel admin para cargar resultados y recalcular.
- SE ELIMINA respecto a la versión completa: campeón, subcampeón, goleador, mejor jugador (y toda la sección "predicciones especiales").

## 2. Stack asumido

Next.js (App Router) + Prisma/Postgres + Tailwind. Cookies vía `next/headers` (`await cookies()`), validación con zod. Hashing con `node:crypto` (scrypt), sin dependencias nuevas. Banderas vía `flagcdn.com` (códigos ISO alpha-2).

## 3. Modelo de datos (Prisma) — simplificado

```prisma
model ProdePlayer {
  id            String   @id @default(uuid())
  instagram     String   @unique
  email         String   @unique
  password_hash String
  total_points  Int      @default(0)   // único puntaje (no hay extras)
  submitted_at  DateTime?
  created_at    DateTime @default(now())
  predictions   ProdeMatchPrediction[]
  @@map("prode_players")
}

model ProdeMatch {
  id         String  @id @default(uuid())
  code       String  @unique          // "A1".."L6"
  group      String
  home_team  String                   // código de equipo
  away_team  String
  home_score Int?
  away_score Int?
  finished   Boolean @default(false)
  predictions ProdeMatchPrediction[]
  @@map("prode_matches")
}

model ProdeMatchPrediction {
  id         String @id @default(uuid())
  player_id  String
  match_id   String
  home_score Int
  away_score Int
  points     Int    @default(0)
  player ProdePlayer @relation(fields: [player_id], references: [id], onDelete: Cascade)
  match  ProdeMatch  @relation(fields: [match_id], references: [id], onDelete: Cascade)
  @@unique([player_id, match_id])
  @@map("prode_match_predictions")
}

model ProdeSettings {        // singleton id="main"
  id                 String  @id @default("main")
  predictions_locked Boolean @default(false)
  updated_at         DateTime @updatedAt
  @@map("prode_settings")
}
```

> Diferencias vs versión completa: en `ProdePlayer` se quitan `champion`, `runner_up`, `top_scorer`, `best_player`, `match_points`, `extras_points` (queda solo `total_points`). En `ProdeSettings` se quitan los campos de respuestas oficiales (solo queda `predictions_locked`).

## 4. Datos del fixture — `src/data/torneo.ts`

- `TEAMS`: `{ code, name, group }[]` (code = ISO2 para la bandera, name en español).
- `GROUPS` = lista de grupos.
- `FIXTURE`: generador round-robin por grupo de 4 → 6 partidos c/u. Orden de pares: `(0-1),(2-3),(0-2),(1-3),(0-3),(1-2)`. Code = `${grupo}${i+1}`.
- Helpers: `teamByCode(code)`, `flagUrl(code, size)` → `https://flagcdn.com/w${size}/${code}.png`.

## 5. Auth — `src/lib/prode/auth.ts`

- `hashPassword` / `verifyPassword` con `scryptSync` (formato `salt:hash`, comparar con `timingSafeEqual`).
- Cookie httpOnly `prode_session` = `playerId.HMAC(playerId, SECRET)`. Validar firma al leer.
- `createSession(playerId)`, `clearSession()`, `getSessionPlayer()` (lee cookie → devuelve player o null).
- Secreto en env `PRODE_SESSION_SECRET`.

## 6. Puntajes — `src/lib/prode/scoring.ts` (simplificado)

```
POINTS = { exactScore: 5, outcome: 2 }   // ¡y nada más!

scoreMatch(pred, real):
  si no finished → 0
  si marcador exacto → exactScore
  si mismo resultado (1/X/2) → outcome
  sino → 0

recalcAll():
  para cada player: sumar scoreMatch de todas sus predicciones
  → total_points = suma ; actualizar cada prediction.points
```

> Se elimina toda la lógica de extras (champion/runnerUp/topScorer/bestPlayer) y la función scoreExtras.

## 7. API routes — `src/app/api/prode/`

- `register` (POST `{instagram,email,password}`): normaliza instagram (saca `@`, lowercase), crea player + suscriptor (ignora duplicado P2002), set cookie. Duplicado → 409.
- `login` (POST `{email,password}`): verifica, set cookie.
- `logout` (POST): clear cookie.
- `me` (GET): `{ player: {instagram, submitted, total_points} | null, locked }`.
- `predictions` (GET): `{ matches:[{id,code,group,home_team,away_team}], locked, mine:{submitted, scores:{[matchId]:{home,away}}} }`.
- `predictions` (POST `{ scores:{[matchId]:{home,away}} }`): rechaza si locked o ya submitted; exige que todos los partidos tengan marcador; crea predicciones + setea `submitted_at` en una transacción.
- `ranking` (GET): players con `submitted_at != null`, orden `total_points desc, submitted_at asc`.
- `admin/prode` (GET/POST): GET devuelve partidos + settings + count; POST guarda marcadores/finished + toggle `predictions_locked` y llama `recalcAll()`.

> Diferencias vs completa: el POST `/predictions` ya no recibe champion/runner_up/top_scorer/best_player. El POST `/admin/prode` ya no recibe ni guarda respuestas oficiales.

## 8. Páginas y componentes

- `src/app/(public)/prode/page.tsx` (server, force-dynamic): hero + "cómo se puntúa" (solo 2 tarjetas: exacto +5 / ganador +2) + grilla de grupos con banderas + ranking. CTA según sesión.
- `src/app/(public)/prode/registro` y `/login`: formularios (cliente) → `ProdeAuthForm` con `mode`.
- `src/app/(public)/prode/jugar/page.tsx` (server: si no hay sesión → redirect a `/prode/login`) → render de `<ProdeForm>`.
- Componentes `src/components/prode/`:
  - `TeamFlag` (bandera + nombre).
  - `ProdeAuthForm` (registro/login).
  - `ProdeForm` (los partidos por grupo con dos inputs de marcador; envío único; modo lectura si ya envió o está cerrado). Sin bloque "predicciones especiales".
  - `RankingTable` (presentacional). Solo Jugador / Puntos.
  - `LogoutButton`.
- Header: agregar link a `/prode`.
- Admin: `src/app/(admin)/admin/prode/page.tsx` + `ProdeAdminClient` (tabla de partidos con inputs + botón "FIN" por partido, toggle "cerrar pronósticos", botón "Guardar y recalcular"). Sin sección de respuestas oficiales.

## 9. Puesta en marcha

1. `prisma migrate dev --name add_prode` + `prisma generate`.
2. Seed (script `.mjs` con `pg`, idempotente con `ON CONFLICT (code)`): inserta los partidos del fixture + fila `prode_settings('main')`.
3. Env: `PRODE_SESSION_SECRET` (local y en el hosting).
4. Verificar flujo: registro → jugar → enviar (bloqueo de reenvío) → admin carga un resultado → recalcular → ranking refleja puntos.

## 10. Checklist de "qué sacar" vs la versión completa

- [x] Schema: sin campos de extras en `ProdePlayer` ni respuestas oficiales en `ProdeSettings`.
- [x] `scoring.ts`: solo `exactScore`/`outcome` y `scoreMatch`; sin `scoreExtras`/`textMatch`.
- [x] predictions API: sin extras en el schema zod ni en el insert.
- [x] admin/prode API: sin respuestas oficiales en el schema ni en el upsert.
- [x] `ProdeForm`: sin sección "predicciones especiales".
- [x] `ProdeAdminClient`: sin sección "respuestas oficiales".
- [x] Landing: 2 tarjetas de puntaje, sin bloque "resultados oficiales".
- [x] `RankingTable`: solo total de puntos.

# 03 · Bases de datos

## Resumen

El proyecto **no requiere base de datos para funcionar**. Arranca con datos
semilla deterministas y, cuando se conecta Zernio, mantiene en memoria lo que
Zernio no cubre. Este documento describe el modelo de datos, dónde vive cada
cosa hoy y cómo migrar a Postgres cuando haga falta.

## Dónde vive cada dato

| Dato | Hoy | Fuente de verdad |
|---|---|---|
| Cuentas conectadas | En memoria, vía gateway | **Zernio** (`GET /v1/accounts`) |
| Publicaciones programadas/publicadas | En memoria, vía gateway | **Zernio** (`GET /v1/posts`) |
| Métricas y series diarias | En memoria, vía gateway | **Zernio** (`GET /v1/analytics`) |
| Seguidores | En memoria, vía gateway | **Zernio** (`/v1/accounts/follower-stats`) |
| Hooks guardados | Store en memoria | **Local** |
| Cuentas competidoras | Store en memoria | **Local** |
| Reels de competidores + transcripciones | Store en memoria | **Local** |
| Noticias de tendencias + scores | Store en memoria | **Local** |
| Plan de contenido del mes | Store en memoria | **Local** |
| Credenciales de integración | `.data/settings.json` | **Local (disco)** |
| Borrador del guion | `localStorage` | **Navegador** |

Regla: **si Zernio lo sabe, no se duplica**. El dashboard relee y no cachea
publicaciones ni métricas en el store propio; así no hay dos verdades.

## El store actual (`lib/domain/repository.ts`)

```ts
interface Store {
  hooks: Hook[];
  competitors: CompetitorAccount[];
  reels: CompetitorReel[];
  trends: TrendItem[];
  plan: ContentPlanEntry[];
  seededAt: string;
}
```

- Se crea la primera vez que se accede y se cuelga de `globalThis` bajo la clave
  `__ccc_store__`, de modo que sobrevive al hot-reload de Next en desarrollo y se
  comparte entre route handlers del mismo proceso.
- Se inicializa desde `lib/domain/seed/*`, que son datos **deterministas**
  (PRNG con semilla fija para las analíticas sintéticas).
- `resetStore()` vuelve a la semilla.

**Limitaciones conocidas** (por eso existe la ruta de migración):

1. Los cambios se pierden al reiniciar el proceso.
2. No se comparte entre instancias: en serverless cada lambda tiene su store.
3. No hay transacciones ni concurrencia controlada.

Para un único creador con un servidor persistente (VPS, Docker) es suficiente.
Para serverless o multi-instancia, hay que migrar.

## Modelo de datos

Los tipos canónicos están en `lib/domain/types.ts`. Tablas a crear si se migra:

### `hooks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `hook_<origen>` o generado |
| `raw_text` | text | Transcipción original |
| `template_text` | text | Plantilla del catálogo |
| `filled_text` | text | Con placeholders resueltos |
| `pattern_id` | text FK | → `hook_patterns` |
| `type` | enum | `HookType` |
| `niche` | enum | `Niche` |
| `views`, `likes`, `saves` | int | Métricas de origen |
| `creator_handle`, `creator_platform` | text | Autor original |
| `source_url`, `source_reel_id` | text | Procedencia |
| `on_screen_text` | text | Texto en pantalla |
| `tags` | text[] | Etiquetas derivadas |
| `is_favorite` | bool | |
| `tier` | enum | `standard \| high \| viral` |
| `saved_at` | timestamptz | |

Índices: `(niche)`, `(type)`, `(pattern_id)`, `(views DESC)`, GIN sobre
`to_tsvector(raw_text || filled_text)` para la búsqueda.

### `hook_patterns`

Catálogo de las 14 plantillas (`lib/domain/hook-patterns.ts`). Es prácticamente
estático: puede vivir en código o sembrarse en tabla para permitir edición.

| Columna | Tipo |
|---|---|
| `id` | text PK |
| `name`, `template`, `rationale`, `example` | text |
| `type` | enum |
| `average_views`, `usage_count` | int |

### `competitor_accounts`

| Columna | Tipo |
|---|---|
| `id` | text PK |
| `platform` | text |
| `username` | text — unique con `platform` |
| `display_name` | text |
| `follower_count` | int |
| `niche` | enum |
| `is_active` | bool |
| `added_at` | timestamptz |

### `competitor_reels`

| Columna | Tipo |
|---|---|
| `id` | text PK |
| `account_id` | text FK → `competitor_accounts` (on delete cascade) |
| `platform`, `url`, `thumbnail_url` | text |
| `views`, `likes`, `comments` | int |
| `posted_at`, `ingested_at` | timestamptz |
| `hook_text`, `on_screen_text`, `transcript` | text |
| `rank` | int — 1..5 dentro de la cuenta |
| `week` | text — `2026-W37` |
| `saved_to_hooks` | bool |

Índices: `(week)`, `(account_id, week)`, `(views DESC)`.

### `trend_sources` y `trend_items`

`trend_sources` es el catálogo de 12 fuentes
(`lib/domain/seed/trends.ts#TREND_SOURCES`).

`trend_items`: `id`, `title`, `summary`, `url` (unique), `source_id` FK,
`published_at`, `hook_score` (int 0-100), `angle`, `hook_suggestion`,
`pattern_id`, `category`.

### `content_plan_entries`

| Columna | Tipo |
|---|---|
| `id` | text PK |
| `date` | date |
| `time` | text — `HH:mm` |
| `platform` | text |
| `hook_id` | text FK → `hooks` (nullable: si el hook se borró) |
| `hook_text` | text — congelado al planificar |
| `angle`, `caption` | text |
| `status` | enum — `idea \| script \| scheduled \| published` |
| `zernio_post_id` | text — id del post en Zernio |
| `created_at` | timestamptz |

Índice único sugerido: `(date, time, platform)` para que el autocompletado sea
idempotente al repetirse sobre el mismo mes.

### `app_settings`

Alternativa a `.data/settings.json` si se migra. Guardaría las credenciales
cifradas en reposo:

| Columna | Tipo |
|---|---|
| `key` | text PK |
| `value` | text — **cifrado** |
| `updated_at` | timestamptz |

## Cómo migrar a Postgres

El repositorio ya está diseñado para esto: **toda su API es asíncrona**.

1. **Añade el driver.** Por ejemplo `postgres` (postgres.js) o Prisma si
   prefieres un esquema declarativo.

2. **Crea las tablas** con el modelo de arriba. Con Prisma, el esquema sería la
   traducción directa de los tipos de `lib/domain/types.ts`.

3. **Sustituye la implementación interna** de `lib/domain/repository.ts`
   manteniendo exactamente las mismas firmas:

   ```ts
   export async function listHooks(query: HookQuery = {}): Promise<Hook[]> {
     // misma firma, ahora contra Postgres
   }
   ```

   Ningún llamador cambia: las páginas y los route handlers ya hacen `await`.

4. **Migra las credenciales** de `.data/settings.json` a la tabla
   `app_settings` **con cifrado en reposo** (por ejemplo `pgcrypto` o
   AES-GCM con una clave en variable de entorno). Mantén enmascarado el valor al
   devolverlo por API.

5. **Añade los índices** de búsqueda; el filtro de la Biblioteca de Hooks debe
   trasladarse a SQL (`ILIKE` o `tsvector`) en lugar de filtrar en memoria.

### Esqueleto con postgres.js

```ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 10 });

export async function listHooks(query: HookQuery = {}): Promise<Hook[]> {
  const term = query.search?.trim();
  return sql<Hook[]>`
    select * from hooks
    where (${query.niche ?? "all"} = 'all' or niche = ${query.niche})
      and (${query.type ?? "all"} = 'all' or type = ${query.type})
      and views >= ${query.minViews ?? 0}
      and (${term ?? null}::text is null
           or raw_text ilike ${"%" + (term ?? "") + "%"}
           or filled_text ilike ${"%" + (term ?? "") + "%"})
    order by views desc
    limit 500
  `;
}
```

## Estrategia de caché (si se migra)

Zernio tiene límites de peticiones por cuenta conectada. La guía oficial para
plataformas sugiere un **worker de sincronización** que lea
`GET /v1/analytics?profileId=…` y persista los snapshots en tu base de datos,
sirviendo el dashboard desde ahí.

Patrón recomendado:

1. Un cron lee `GET /v1/analytics/delta` con el cursor guardado y actualiza las
   filas que cambiaron (no recorre todo).
2. El dashboard lee de **tu** base de datos, no de Zernio.
3. Se guarda `last_synced_at` por cuenta para mostrar la frescura del dato.

Mientras el dashboard sea de un único creador con poco volumen, leer Zernio en
vivo es perfectamente asumible y es lo que hace hoy `zernio-gateway.ts`.

## Datos semilla

`lib/domain/seed/` contiene la demo:

| Archivo | Contenido |
|---|---|
| `hooks.ts` | 22 hooks con métricas, tags y favoritos |
| `competitors.ts` | 8 cuentas y 40 Reels (5 por cuenta) con transcript y hooks |
| `trends.ts` | 12 fuentes y 12 noticias ya clasificadas |
| `analytics.ts` | 180 días de métricas diarias, 20 posts y series de seguidores |
| `accounts.ts` | 5 cuentas conectadas y 16 posts programados |

Las analíticas se generan con `mulberry32(20260919)`: la misma semilla produce
siempre los mismos destacados, para que las capturas y los tests sean
reproducibles.

# 02 · Arquitectura

## Vista general

```
┌──────────────────────────────────────────────────────────────────────┐
│  Navegador                                                           │
│  Server Components (HTML)  +  Client Components (React Query)        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ fetch /api/*
┌────────────────────────────▼─────────────────────────────────────────┐
│  Route Handlers (app/api/*)                                          │
│  · Validan con Zod                                                   │
│  · Nunca exponen credenciales                                        │
└───────┬──────────────────────────────┬───────────────────────────────┘
        │                              │
┌───────▼────────────────┐  ┌──────────▼───────────────────────────────┐
│  lib/domain            │  │  lib/services                            │
│  · repository (store)  │  │  · ai.ts          (OpenAI/Anthropic)     │
│  · zernio-gateway      │  │  · captions.ts                           │
│  · hook-engine         │  │  · transcription.ts                      │
│  · analytics-service   │  │  · calendar-service.ts                   │
│  · seed/               │  │  · trend-classifier.ts                   │
└────────────┬───────────┘  └──────────┬───────────────────────────────┘
             │                         │
┌────────────▼─────────────────────────▼───────────────────────────────┐
│  lib/zernio/client.ts  →  https://zernio.com/api/v1                  │
│  lib/server/settings-store.ts  →  .data/settings.json                │
└──────────────────────────────────────────────────────────────────────┘
```

## Capas

### 1. Presentación (`app/(dashboard)/*`, `components/`)

- **Server Components**: las páginas leen directamente del repositorio o del
  gateway (sin HTTP interno) y pasan datos ya tipados a los componentes cliente
  como `initialData`. Esto evita un *waterfall* de peticiones en el primer render.
- **Client Components**: sólo donde hay interacción (filtros, formularios,
  gráficas, calendario). Consumen `/api/*` con React Query.
- La única excepción es `/settings`, que carga por `fetch` porque su estado
  cambia tras cada guardado.

**Frontera crítica**: `lib/zernio/config.ts` y `lib/server/*` importan `node:fs`.
Ningún archivo con `"use client"` puede importarlos. Los tipos puros
(`lib/domain/types.ts`, `lib/zernio/types.ts`) y los catálogos
(`lib/domain/hook-patterns.ts`) sí son seguros en cliente.

### 2. API (`app/api/*`)

Un route handler por recurso. Todos:

1. Validan el body con Zod (`safeParse`) y devuelven `400` con
   `{ error, issues }` si falla.
2. Delegan en el dominio o en los servicios; no contienen lógica de negocio.
3. Devuelven JSON con el shape que espera la UI.

`export const dynamic = "force-dynamic"` en todas: son datos vivos, no se deben
cachear en build.

### 3. Dominio (`lib/domain/*`)

| Módulo | Responsabilidad |
|---|---|
| `zernio-gateway.ts` | **Única** puerta a Zernio desde la UI. Real vs. demo y degradación. |
| `repository.ts` | Store de los datos propios (hooks, competidores, tendencias, plan). |
| `hook-engine.ts` | Clasificación determinista de texto libre → plantilla + tipo + nicho. |
| `analytics-service.ts` | Cálculo puro de series, deltas, destacados y top 5. |
| `hook-patterns.ts` | Catálogo de las 14 plantillas. |
| `seed/` | Datos semilla deterministas para la demo. |

### 4. Servicios (`lib/services/*`)

`ai.ts` es la capa de IA; `captions.ts` la usa para refinar captions;
`transcription.ts` convierte audio en hook; `calendar-service.ts` autocompleta el
mes; `trend-classifier.ts` puntúa noticias. Toda función de alto nivel degrada a
una versión local si el proveedor externo falla.

### 5. Integración (`lib/zernio/*`, `lib/server/*`)

- `client.ts`: `fetch` tipado con `ZernioError` (status, code, `retryable`),
  construcción de query, `x-request-id`/`Idempotency-Key` y override de `apiKey`
  para las pruebas de conexión.
- `types.ts`: contrato de la API modelado a mano.
- `accounts.ts`, `posts.ts`, `analytics.ts`, `media.ts`: funciones por recurso.
- `settings-store.ts`: persistencia de credenciales (sólo servidor).

## Flujos de datos

### Flujo A · Lectura con degradación (`/analytics`)

```
AnalyticsPage (RSC)
  └─ AnalyticsDashboard (client) → fetch /api/analytics?range=30
        └─ getAnalyticsSnapshot(range)
             ├─ DEMO o sin key → buildAnalyticsSnapshot(DEMO_*)
             └─ con key        → Promise.all([daily-metrics, analytics, follower-stats])
                                   └─ fallo → { source:"demo", warning }
                                   └─ ok    → buildAnalyticsSnapshot(real)
```

`buildAnalyticsSnapshot` es una función **pura**: el mismo código produce la
respuesta con datos reales y con semilla, y es trivial de testear.

### Flujo B · Publicación (`/scheduler`)

```
Scheduler (client) → POST /api/schedule
  └─ valida con Zod
      └─ publish({content, platforms, scheduledFor, timezone})
           ├─ demo → simulatePost()  → { simulated: true }
           └─ real → createPost()    → POST /v1/posts  (x-request-id)
                       └─ ZernioError → 502 { error }
```

### Flujo C · Hook → guion → publicación

```
/hooks · "Usar este hook"
  └─ insertHookIntoDraft()  → localStorage + evento "ccc:script-draft"
      └─ navega a /script
          ├─ "Generar guion con IA" → POST /api/ai/script  → rellena body + caption
          ├─ "Variaciones de hook"  → POST /api/ai/hooks   → lista para elegir
          └─ "Enviar al Programador" → /scheduler (lee el borrador)
                └─ POST /api/schedule → Zernio
```

El traspaso entre páginas se hace por `localStorage` + evento `CustomEvent` para
no obligar a un round-trip al servidor. `lib/client/script-draft.ts` es el único
módulo con estado de cliente persistente.

### Flujo D · Autocompletado del calendario (`/calendar`)

```
POST /api/calendar { action:"autofill", month, perWeek, platforms }
  └─ listHooks() + listTrends(minScore:80)
      └─ autoFillMonth()
           ├─ ordena hooks: favoritos → más vistos
           ├─ elige huecos por peso histórico (OPTIMAL_SLOTS)
           ├─ rota ángulos (CONTENT_ANGLES) y evita repetir plantilla seguida
           ├─ genera caption por pieza (heurística o IA)
           └─ upsert de cada ContentPlanEntry
```

## Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|---|---|---|
| Server Components leen el dominio directamente | Sin HTTP interno ni doble serialización | Fetch interno a `/api` desde el RSC |
| Gateway único a Zernio | Un solo lugar donde decidir demo/real y degradar | Llamar a Zernio desde cada handler |
| Store en memoria con API asíncrona | Migrar a DB no toca llamadores | Base de datos desde el día 1 |
| Cálculo de analíticas como función pura | Testeable y reutilizable | Cálculo repartido en la UI |
| Motor de hooks determinista | Explicable, gratis, ejecutable al guardar | Clasificar con LLM en cada guardado |
| IA con degradación a heurístico | La UI nunca se queda sin respuesta | Fallar y mostrar error |
| Config sincrónica con `fs.readFileSync` | Los getters existentes siguen síncronos | Hacer asíncrona toda la config |
| Credenciales enmascaradas en la API | El navegador nunca ve el secreto | Devolver el valor y confiar en el cliente |

## Rendimiento

- `initialData` en React Query evita el estado de carga en la primera pintura de
  la Biblioteca de Hooks.
- `staleTime: 30_000` y `refetchOnWindowFocus: false` como valores por defecto.
- El primer render de `/analytics` son ~111 kB (Recharts es el grueso).
- Las páginas son dinámicas por diseño; el único HTML prerenderizado es `/` y el
  404.

## Errores y observabilidad

- **Route handlers**: validación Zod → 400; errores de Zernio → `502` con el
  mensaje; 404 en recursos inexistentes.
- **Zernio** (`lib/zernio/client.ts`): `ZernioError` conserva `status`, `code`,
  `type`, `param`, `details` y marca `retryable` para 429 y 5xx.
- **Degradación silenciosa y visible**: cuando Zernio falla, la UI sigue
  funcionando con datos semilla y el campo `warning` explica por qué.
- **Registro**: `console.warn` en los puntos de degradación (lectura de settings,
  transcripción, fallback de IA).

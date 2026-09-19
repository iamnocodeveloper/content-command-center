# 09 · Referencia de la API

Todos los endpoints propios viven bajo `/api` y devuelven JSON. Salvo
`/api/cron/*`, no requieren autenticación (el dashboard asume un único usuario).
Todas las rutas son dinámicas (`force-dynamic`).

Los cuerpos de entrada se validan con Zod; ante un fallo devuelven
`400 { error, issues }`.

---

## Estado

### `GET /api/status`

Estado de la integración y cuentas conectadas.

```json
{
  "demo": true,
  "profileId": "66a1f0c2…",
  "source": "demo",
  "warning": null,
  "accounts": [
    { "id": "acc_ig_main", "platform": "instagram", "username": "tenfoldmarc",
      "displayName": "Marc · tenfoldmarc", "isActive": true, "followerCount": 41280 }
  ]
}
```

`source` es `zernio` o `demo`. Cuando es `demo` por un fallo real, `warning` lleva
el motivo.

---

## Configuración

### `GET /api/settings`

Configuración activa. **Los secretos nunca se devuelven**: sólo una versión
enmascarada y un booleano.

```json
{
  "zernio": {
    "apiKey": "sk_abc••••••••1234", "apiKeyConfigured": true,
    "apiKeySource": "file", "profileId": "66a1…", "profileIdSource": "file",
    "timezone": "America/Mexico_City", "timezoneSource": "env",
    "demoMode": "auto"
  },
  "ai": {
    "provider": "openai",
    "openaiApiKey": "sk-…•1234", "openaiApiKeyConfigured": true, "openaiApiKeySource": "file",
    "openaiModel": "gpt-4o-mini",
    "anthropicApiKey": null, "anthropicApiKeyConfigured": false, "anthropicApiKeySource": "unset",
    "anthropicModel": "claude-sonnet-4-5"
  },
  "transcription": { "provider": "mock", "deepgramApiKey": null,
    "deepgramApiKeyConfigured": false, "deepgramApiKeySource": "unset" },
  "runtime": { "demoMode": false, "aiReady": true, "transcriptionReady": true, "dataDir": ".data" },
  "defaults": { }
}
```

`source` ∈ `file` (guardado en el panel) · `env` (variable de entorno) · `unset`.

### `PUT /api/settings`

Guarda una o varias secciones. Cada sección es parcial: guardar IA no toca
Zernio. Un campo con **cadena vacía borra** el valor guardado.

```jsonc
{
  "zernio": { "apiKey": "sk_…", "profileId": "66a1…", "timezone": "America/Bogota", "demoMode": "auto" },
  "ai": { "provider": "anthropic", "anthropicApiKey": "sk-ant-…", "anthropicModel": "claude-sonnet-4-5" },
  "transcription": { "provider": "deepgram", "deepgramApiKey": "…" }
}
```

Devuelve el mismo payload que `GET` más:

- `persisted` (bool): si se pudo escribir en disco. `false` en sistemas de
  archivos efímeros.
- `warning` (string|null): el motivo cuando `persisted` es `false`.

### `POST /api/settings`

Prueba credenciales **sin guardarlas**.

```jsonc
// Prueba de Zernio (usa la clave enviada o, si falta, la configurada)
{ "action": "test-zernio", "apiKey": "sk_…", "profileId": "66a1…" }
// → { ok, message, latencyMs, accountCount, accounts: [...], hint }

// Prueba del modelo de IA
{ "action": "test-ai", "provider": "openai", "apiKey": "sk-…", "model": "gpt-4o-mini" }
// → { ok, provider, model, message, latencyMs, sample }
```

En fallo de Zernio: `{ ok: false, status, code, message }` con el mensaje
traducido (401 → clave inválida, 402 → pago requerido, 403 → permisos, 429 →
límite).

---

## Biblioteca de hooks

### `GET /api/hooks`

| Query | Tipo | Defecto |
|---|---|---|
| `search` | texto (texto, creador, tags, plantilla) | — |
| `niche` | `Niche` \| `all` | `all` |
| `type` | `HookType` \| `all` | `all` |
| `patternId` | string | — |
| `minViews` / `maxViews` | número | 0 / ∞ |
| `favoritesOnly` | `true` | `false` |
| `sortBy` | `views` \| `saves` \| `engagement` \| `savedAt` | `views` |
| `order` | `asc` \| `desc` | `desc` |

```json
{ "hooks": [ { "id": "hook_…", "rawText": "…", "templateText": "[X]…",
  "patternId": "callout-destroy", "type": "callout", "niche": "marketing",
  "views": 1284000, "tier": "viral", "creatorHandle": "@tenfoldmarc", "isFavorite": true } ],
  "count": 22 }
```

### `POST /api/hooks`

Crea un hook: el motor lo clasifica y lo convierte en plantilla.

```jsonc
{
  "rawText": "3 errores que te cuestan clientes cada semana",  // requerido, ≥4
  "onScreenText": "3 ERRORES QUE TE CUESTAN CLIENTES",
  "views": 250000, "likes": 18000, "saves": 5200,
  "creatorHandle": "@tenfoldmarc",           // requerido
  "creatorPlatform": "instagram",            // requerido
  "sourceUrl": "https://instagram.com/reel/…",
  "sourceReelId": "reel_cl001",
  "niche": "negocios", "patternId": "listicle-errors", "tags": ["clientes"]
}
```

`201 { hook }`. Si ya existe un hook con el mismo `sourceReelId`, devuelve el
existente (idempotente).

### `PATCH /api/hooks/{id}`

```jsonc
{ "isFavorite": true, "niche": "marketing", "tags": ["…"], "patternId": "…" }
```

`200 { hook }` · `404` si no existe.

### `DELETE /api/hooks/{id}`

`200 { ok: true }` · `404`.

---

## Analíticas

### `GET /api/analytics?range=7|30|90`

```json
{
  "source": "demo",
  "warning": null,
  "snapshot": {
    "range": 30,
    "series": [ { "date": "2026-09-01", "views": 12400, "saves": 210,
                  "followers": 76500, "engagement": 1180, "postCount": 1 } ],
    "metrics": { "views": { "total": 0, "previous": 0, "delta": 0, "spark": [] } },
    "totals": { "impressions": 0, "reach": 0, "likes": 0, "comments": 0,
                "shares": 0, "saves": 0, "clicks": 0, "views": 0 },
    "averageEngagementRate": 7.42,
    "baseline30d": 14200,
    "totalPosts": 20,
    "platformBreakdown": [ { "platform": "instagram", "postCount": 58, "views": 0 } ],
    "standout": [ { "post": { }, "multiplier": 3.4, "reason": "Destacado: …" } ],
    "topPosts": [ { "rank": 1, "post": { }, "explanation": "…",
                    "signals": ["…"], "patternName": "Callout destructivo",
                    "engagementRate": 11.2, "saveRate": 4.1 } ],
    "followers": { "total": 79500, "change": 1240, "byPlatform": [] }
  }
}
```

---

## Competidores

### `GET /api/competitors`

| Query | Tipo |
|---|---|
| `week` | `2026-W37` (por defecto, la más reciente) |
| `accountId` | id de la cuenta |
| `platform` | `instagram` \| `tiktok` \| … |
| `search` | texto sobre hook, texto en pantalla y transcripción |

```json
{
  "competitors": [ { "id": "cmp_001", "username": "@growthlab.io",
                     "platform": "instagram", "followerCount": 842000, "niche": "marketing" } ],
  "reels": [ { "id": "reel_cl001", "accountId": "cmp_001", "views": 2140000,
               "hookText": "Tu embudo está roto…", "onScreenText": "EL 90% ROMPE…",
               "transcript": "…", "rank": 1, "week": "2026-W37",
               "savedToHooks": false, "account": { } } ],
  "week": "2026-W37",
  "weeks": ["2026-W37"]
}
```

### `POST /api/competitors`

```jsonc
{ "username": "@nuevaCuenta", "platform": "instagram",
  "displayName": "Nueva", "followerCount": 120000, "niche": "marketing" }
```

`201 { competitor }`. Idempotente por `(username, platform)`.

### `DELETE /api/competitors/{id}`

Elimina la cuenta **y sus reels** (cascade). `200 { ok: true }` · `404`.

### `POST /api/competitors/reels/{id}/save`

Guarda el hook del reel en la biblioteca. `201 { hook }` · `404`.

---

## Tendencias

### `GET /api/trends`

| Query | Tipo | Defecto |
|---|---|---|
| `sourceId` | id de fuente | — |
| `category` | `Agentes`, `Modelos`, `Regulación`… | — |
| `minScore` | 0-100 | — |
| `search` | texto | — |
| `sortBy` | `hookScore` \| `publishedAt` | `hookScore` |
| `limit` | número | — |

```json
{
  "trends": [ { "id": "trend_000", "title": "OpenAI lanza…", "summary": "…",
                "url": "https://…", "sourceName": "OpenAI Blog", "hookScore": 96,
                "angle": "Demostración práctica…",
                "hookSuggestion": "Esto acaba de destruir 6 horas…",
                "patternId": "callout-destroy", "category": "Agentes" } ],
  "sources": [ { "id": "openai-blog", "name": "OpenAI Blog", "kind": "rss",
                 "category": "labs" } ],
  "bySource": [ { "id": "openai-blog", "itemCount": 1, "topScore": 96 } ]
}
```

---

## Captions e IA

### `POST /api/captions`

Genera una caption por plataforma (heurística o refinada con IA).

```jsonc
{ "hook": "Deja de publicar todos los días", "angle": "Error común",
  "niche": "marketing", "platforms": ["instagram", "tiktok"],
  "notes": "Menciona la plantilla gratis", "durationSeconds": 30 }
```

```json
{ "provider": "openai",
  "variants": [ { "platform": "instagram", "caption": "…",
                  "hashtags": ["marketing", "…"], "firstComment": "…",
                  "refined": true, "full": "…" } ] }
```

### `POST /api/ai/script`

```jsonc
{ "hook": "…", "angle": "…", "niche": "marketing", "platform": "instagram",
  "durationSeconds": 30, "notes": "…" }
```

```json
{ "hook": "…", "beats": ["1. …", "2. …"], "cta": "…", "caption": "…",
  "hashtags": ["…"], "source": "openai", "captionFull": "…", "note": null }
```

`source` es `openai` · `anthropic` · `fallback`. Con `fallback`, `note` explica el
motivo.

### `POST /api/ai/hooks`

```jsonc
{ "base": "nadie te dice la verdad sobre crear contenido",
  "niche": "negocios", "count": 5 }
```

```json
{ "variants": [ { "text": "…", "pattern": "Deja de hacer [X]",
                  "rationale": "…" } ],
  "source": "fallback", "note": "…" }
```

### `POST /api/ai/rewrite`

```jsonc
{ "caption": "…", "platform": "linkedin", "niche": "marketing", "hook": "…" }
```

```json
{ "text": "…", "source": "anthropic", "note": null }
```

---

## Programación

### `POST /api/schedule`

```jsonc
{
  "content": "Deja de publicar todos los días",           // requerido
  "date": "2026-10-05",                                   // programar…
  "time": "18:30",
  "timezone": "America/Mexico_City",
  "publishNow": false,                                    // …o publicar ya
  "isDraft": false,                                       // …o borrador
  "firstComment": "Plantilla en el comentario fijado 👇",
  "mediaItems": [{ "url": "https://media.zernio.com/…", "type": "image" }],
  "platforms": [                                          // requerido, ≥1
    { "platform": "instagram", "accountId": "acc_ig_main" }
  ]
}
```

Sin `date`+`time`, `publishNow` ni `isDraft` → `400`.

```json
{ "post": { "_id": "65f1…", "status": "scheduled", "platforms": [ ] },
  "simulated": false }
```

`simulated: true` en modo demo (no se llamó a Zernio). Error de Zernio → `502`.

---

## Calendario

### `GET /api/calendar?month=YYYY-MM`

```json
{ "entries": [ { "id": "plan_2026-10-07_instagram", "date": "2026-10-07",
                 "time": "18:00", "platform": "instagram", "hookText": "…",
                 "angle": "…", "caption": "…", "status": "idea" } ],
  "posts": [ { "_id": "post_sched_01", "content": "…", "status": "scheduled" } ],
  "source": "demo", "warning": null }
```

### `POST /api/calendar`

Cuatro acciones, discriminadas por `action`:

```jsonc
// 1. Autocompletar el mes
{ "action": "autofill", "month": "2026-10", "perWeek": 3,
  "platforms": ["instagram", "tiktok"], "niche": "marketing", "preferredHour": 18 }
// → 201 { entries: [...], summary: "13 publicaciones planificadas…" }

// 2. Crear o editar una entrada
{ "action": "upsert", "entry": { "id": "…", "date": "2026-10-07", "time": "18:00",
  "platform": "instagram", "hookText": "…", "angle": "…", "caption": "…",
  "status": "script", "createdAt": "…" } }

// 3. Vincular una entrada con su post de Zernio
{ "action": "link", "entryId": "…", "zernioPostId": "65f1…" }

// 4. Eliminar
{ "action": "remove", "entryId": "…" }
```

---

## Cron

Requieren `Authorization: Bearer $CRON_SECRET` cuando la variable está definida
(401 si no coincide). Sin la variable quedan abiertos para pruebas locales.

### `GET /api/cron/competitors`

Domingos 06:00 (hora local). Devuelve el resumen de la ingesta.

```json
{ "mode": "demo", "message": "…", "competitors": 8, "reels": 40,
  "week": "2026-W37", "durationMs": 87 }
```

### `POST /api/cron/competitors`

Diagnóstico: reels acumulados por semana.

```json
{ "byWeek": { "2026-W37": 40 }, "total": 40 }
```

### `GET /api/cron/trends`

Ingesta diaria de los 12 feeds.

```json
{ "ingested": 48, "keptPrevious": false, "fallbackUsed": 0,
  "perSource": [ { "source": "OpenAI Blog", "items": 6 } ],
  "durationMs": 2840 }
```

Si todas las fuentes fallan, `keptPrevious: true` y no se toca el material
existente.

---

## Códigos de estado usados

| Código | Cuándo |
|---|---|
| `200` | Lectura u operación correcta |
| `201` | Recurso creado (hook, post, entrada de plan) |
| `400` | Body inválido (Zod) o combinación de campos incorrecta |
| `401` | Cron sin `CRON_SECRET` válido |
| `404` | Recurso inexistente |
| `502` | Zernio rechazó la operación de publicación |

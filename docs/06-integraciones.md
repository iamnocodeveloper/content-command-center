# 06 · Integraciones

## Zernio

**Base URL:** `https://zernio.com/api/v1` · **Docs:** https://docs.zernio.com

Todos los endpoints del dashboard pasan por `lib/domain/zernio-gateway.ts`, que
decide entre datos reales y de demostración y degrada cuando la API falla.

### Credenciales

| Dato | Dónde se obtiene | Dónde se configura |
|---|---|---|
| API key (`sk_` + 64 hex) | [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys) | `/settings` o `ZERNIO_API_KEY` |
| Profile ID (`_id` de 24 caracteres) | `POST /v1/profiles` → `profile._id` | `/settings` o `ZERNIO_PROFILE_ID` |
| Timezone | — | `/settings` o `ZERNIO_DEFAULT_TIMEZONE` |

Zernio guarda sólo el hash SHA-256 de la clave: **no se puede recuperar**, sólo
rotar. La cabecera es `Authorization: Bearer sk_…` en cada petición.

### Endpoints usados

| Endpoint | Para qué | Implementación |
|---|---|---|
| `GET /v1/accounts` | Cuentas conectadas y su plataforma | `lib/zernio/accounts.ts` |
| `POST /v1/profiles` | Crear el perfil que agrupa las cuentas | idem |
| `GET /v1/connect/{platform}` | URL de autorización OAuth | idem |
| `GET /v1/accounts/follower-stats` | Historial de seguidores (add-on Analytics) | idem |
| `POST /v1/posts` | Programar o publicar | `lib/zernio/posts.ts` |
| `GET /v1/posts` | Listado con filtros | idem |
| `GET /v1/posts/{id}` | Estado de un post | idem |
| `DELETE /v1/posts/{id}` | Cancelar | idem |
| `GET /v1/analytics` | Métricas por post y `overview` | `lib/zernio/analytics.ts` |
| `GET /v1/analytics/daily-metrics` | Serie diaria + desglose por plataforma | idem |
| `GET /v1/analytics/best-time-to-post` | Huecos óptimos de publicación | idem |
| `GET /v1/analytics/instagram/account-insights` | Insights de cuenta IG | idem |
| `POST /v1/media/presign` + `PUT` | Subida de media | `lib/zernio/media.ts` |

### Publicación multiplataforma

Un único `POST /v1/posts` cubre todas las plataformas:

```jsonc
{
  "content": "Deja de publicar todos los días en Instagram",
  "platforms": [
    { "platform": "instagram", "accountId": "66b2…" },
    { "platform": "tiktok",    "accountId": "66b3…" }
  ],
  "scheduledFor": "2026-10-05T18:30:00",   // hora de pared
  "timezone": "America/Mexico_City"        // cómo interpretarla
}
```

Los tres modos son excluyentes:

| Se envía | Resultado |
|---|---|
| `scheduledFor` + `timezone` | Publica en esa hora local; Zernio almacena el instante UTC |
| `publishNow: true` | Publica de inmediato |
| ninguno | Se guarda como borrador |

**Idempotencia**: se envía `x-request-id`. Zernio deduplica por hash de contenido
en una ventana de 24 h: un reintento devuelve el post original en lugar de crear
uno duplicado. Sin esa cabecera, repetir el mismo contenido devuelve `409`.

### Analíticas y add-on

- `GET /v1/analytics` acepta `fromDate`/`toDate` (máximo 366 días), `postId`,
  `platform`, `profileId`, `accountId`, `source` (`late` = publicado vía Zernio,
  `external` = sincronizado de la plataforma), `sortBy` y paginación.
- Un post concreto puede devolver **202** (sincronización pendiente) o **424**
  (todas las plataformas fallaron).
- `follower-stats` y varias métricas requieren el **add-on de Analytics**. Sin él
  la llamada falla y el gateway degrada a la demo con un `warning`.
- En cuentas personales de LinkedIn las métricas sólo existen para lo publicado a
  través de Zernio; las páginas de empresa funcionan siempre.

### Códigos de error

El envelope es siempre el mismo:

```json
{ "error": "…", "type": "invalid_request_error", "code": "invalid_field_value", "param": "contentType" }
```

`lib/zernio/client.ts` los convierte en `ZernioError` con `status`, `code`,
`type`, `param`, `details` y `retryable` (`true` para 429 y 5xx). En `/settings`
se traducen a mensajes accionables:

| Status | Mensaje |
|---|---|
| 401 | La API key no es válida o fue revocada |
| 402 | Zernio requiere un método de pago para esa operación |
| 403 | La clave no tiene permisos sobre ese perfil |
| 429 | Demasiadas peticiones, espera unos segundos |

**429**: la clave de la respuesta es respetar el `Retry-After`. El cliente marca
`retryable` y la UI no reintenta en bucle.

### Flujo de conexión de una cuenta nueva

1. `POST /v1/profiles { name }` → `profile._id`.
2. `GET /v1/connect/{platform}?profileId=…` → `authUrl`.
3. Abrir `authUrl` y autorizar (Zernio aloja la pantalla; algunas plataformas
   piden elegir Página, tablero o ubicación).
4. `GET /v1/accounts` → `accountId` de la cuenta recién conectada.
5. Ya se puede publicar con ese `accountId` en `platforms[]`.

### Media

Flujo en 3 pasos (`lib/zernio/media.ts`):

1. `POST /v1/media/presign { filename, contentType, size }` → `uploadUrl` +
   `publicUrl`. El `uploadUrl` caduca en 1 hora.
2. `PUT` del binario a `uploadUrl` **sin** cabecera `Authorization` (va al
   storage, no a la API).
3. `POST /v1/posts` con `mediaItems: [{ url: publicUrl, type: "image" }]`.

Límites: 5 GB por archivo; las URLs de Google Drive, Dropbox, OneDrive e iCloud
**no sirven** (devuelven HTML, no el archivo). Las subidas caducan a los 7 días
si no se publican; al publicar, Zernio copia el archivo a almacenamiento
permanente.

`customMedia` permite enviar un archivo distinto a una plataforma concreta dentro
del mismo post.

---

## Transcripción

`lib/services/transcription.ts`

| Proveedor | Cuándo usarlo | Requisito |
|---|---|---|
| `mock` (defecto) | Demo y desarrollo | Ninguno. Genera una transcripción plausible a partir del hook. |
| `openai` | Producción sencilla | `OPENAI_API_KEY` (Whisper, `POST /v1/audio/transcriptions`) |
| `deepgram` | Alternativa con mejor latencia | `DEEPGRAM_API_KEY` (`nova-2`) |

Con `openai` el archivo se descarga y se reenvía como `multipart/form-data`; con
`deepgram` se pasa la URL directamente al modelo.

Si el proveedor configurado falla, se registra un `console.warn` y se devuelve la
transcripción simulada: **la ingesta de competidores nunca se queda sin datos**.

### Extracción del hook

```ts
extractHook(transcript) // primera frase con carga semántica
```

Descarta aperturas vacías (`hola`, `qué tal`, `buenos días`, `bienvenidos`,
`hoy te voy a…`, `en este video…`) y exige más de 20 caracteres. Devuelve el hook
sin puntuación final, listo para entrar en el motor de plantillas.

---

## Pipeline real de competidores

Hoy el cron sirve la captura semanal de demostración. Para conectarlo de verdad,
los pasos (ya enumerados en `app/api/cron/competitors/route.ts`) son:

```
1. GET /v1/accounts                              → resolver accountIds de las 8 cuentas
2. GET /v1/accounts/{accountId}/posts            → los 25 posts nativos más recientes
3. GET /v1/analytics?postId={id}&platform=       → métricas de cada uno
4. ordenar por views y quedarse con el top 5     → por cuenta
5. transcribe({ mediaUrl })                      → audio a texto
6. extractHook(transcript) + extractOnScreenText → hook hablado y texto en pantalla
7. persistir los CompetitorReel con la semana ISO
```

Consideraciones:

- El límite de peticiones depende del número de cuentas conectadas; conviene
  espaciar las llamadas y respetar `Retry-After` en 429.
- La transcripción es la parte cara y lenta: hazla en paralelo con un límite de
  concurrencia (3-5) y guarda el resultado para no repetirla.
- El paso 2 sólo devuelve las publicaciones **nativas** de la plataforma, que es
  justo lo que se quiere para vigilar competidores.
- Si una cuenta falla, se registra y se continúa: el cron no debe abortar entero.

---

## Cron

| Endpoint | Cadencia declarada | Cadencia real |
|---|---|---|
| `/api/cron/competitors` | `0 12 * * 0` (UTC) | Domingos **06:00** en UTC-6 |
| `/api/cron/trends` | `0 13 * * *` (UTC) | Diario, 07:00 en UTC-6 |

Vercel Cron **sólo acepta expresiones en UTC**: si cambias de zona horaria,
recalcula la expresión (`hora_local_UTC = hora_local + offset`).

### Autenticación

`lib/server/cron-auth.ts` compara `Authorization: Bearer $CRON_SECRET`. Vercel
Cron añade esa cabecera automáticamente cuando la variable está definida. Sin
`CRON_SECRET`, el endpoint queda abierto para poder probarlo en local:

```bash
curl http://localhost:3000/api/cron/trends
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/competitors
```

### Ingesta de tendencias

`GET /api/cron/trends` lee los 12 feeds RSS/Atom en paralelo
(`Promise.allSettled`, timeout de 12 s por feed) con un parser propio sin
dependencias, normaliza los items, los clasifica y **sólo escribe si obtuvo
resultados**. Si todas las fuentes fallan, conserva el material anterior en lugar
de vaciar el panel.

---

## Webhooks (no implementados)

Zernio puede empujar eventos en vez de que el dashboard pregunte. Los relevantes
si se quiere reaccionar en tiempo real:

| Evento | Uso |
|---|---|
| `post.published` / `post.failed` | Actualizar el estado en el calendario al instante |
| `analytics.synced` | Leer `GET /v1/analytics/delta` con el cursor y refrescar métricas |
| `account.connected` / `account.disconnected` | Refrescar cuentas y avisar de reconexión |
| `message.received` / `comment.received` | Volumen de DMs y comentarios en Analíticas |

La firma se verifica con el secreto del endpoint. Si se implementan, conviene
deduplicar por id de evento y responder siempre rápido (encolar el trabajo
pesado).

---

## Resiliencia en una frase

Cada integración externa tiene **una versión local** a la que caer: Zernio → datos
semilla, IA → heurístico, transcripción → mock. Un fallo de un tercero nunca deja
la interfaz en blanco; como mucho, muestra datos de demostración y un `warning`
con el motivo.

# CLAUDE.md

Documento maestro del proyecto. Recoge el stack, la arquitectura y **todas las
decisiones técnicas** tomadas al construirlo, con el motivo y la alternativa
descartada. Si vas a tocar código, empieza por aquí.

---

## 1. Qué es

**Content Command Center**: dashboard de contenido para un creador
(@tenfoldmarc) construido sobre la **API de Zernio**
(https://docs.zernio.com). Cubre seis secciones:

| # | Sección | Ruta | Fuente de datos |
|---|---------|------|-----------------|
| 1 | Biblioteca de Hooks | `/hooks` | Store propio + motor de plantillas |
| 2 | Analíticas | `/analytics` | **Zernio** `/v1/analytics` |
| 3 | Seguimiento de Competidores | `/competitors` | Store propio + cron semanal |
| 4 | Programador | `/scheduler` | **Zernio** `/v1/posts` |
| 5 | Calendario de Contenido | `/calendar` | Store propio + posts de Zernio |
| 6 | Tendencias | `/trends` | 12 feeds RSS de IA |

Más dos rutas de apoyo: `/script` (estudio de guiones, destino de «Usar este
hook») y `/settings` (conexiones con Zernio y con el modelo de IA).

---

## 2. Stack

| Capa | Elección | Versión | Por qué |
|------|----------|---------|---------|
| Framework | Next.js (App Router) | 15.5 | Server Components para leer la API sin exponer la key; Route Handlers para el proxy de integraciones; despliegue trivial en Vercel o Docker. |
| Lenguaje | TypeScript | 5.7 | `strict: true`. Los tipos de la API de Zernio están modelados a mano en `lib/zernio/types.ts`. |
| UI | React | 19 | Requisito de Next 15. |
| Estilos | Tailwind CSS | 3.4 | Config en `tailwind.config.ts` con variables CSS (enfoque shadcn). Se eligió v3 sobre v4 por estabilidad con los componentes shadcn escritos a mano. |
| Componentes | shadcn/ui (new-york) | — | Copiados al repo en `components/ui/`, no instalados como dependencia: control total y cero sorpresas de versionado. Sobre Radix UI. |
| Iconos | lucide-react | 0.474 | Es la librería por defecto de shadcn. |
| Gráficas | Recharts | 2.15 | `AreaChart` + `BarChart` con `ResponsiveContainer`. |
| Datos cliente | TanStack Query | 5.x | Caché, `initialData` desde el servidor y refetch por filtros. |
| Tema | next-themes | 0.4 | Modo oscuro por defecto (`defaultTheme="dark"`). |
| Fechas | date-fns | 4.x | Con locale `es` para el calendario. |
| Validación | Zod | 3.24 | Todo route handler valida su body con `safeParse`. |
| Toasts | sonner | 1.7 | Envoltorio propio en `components/ui/sonner.tsx`. |
| Fuentes | geist | 1.3 | **Self-hosted**: no hay petición a Google Fonts en build, así que el build funciona sin red. |
| HTTP a Zernio | `fetch` nativo | — | Cliente propio en `lib/zernio/client.ts` en vez del SDK oficial: control de tipos, del envelope de error y de las cabeceras de idempotencia. |

### No se usó (y por qué)

- **`create-next-app`**: el scaffolding se escribió a mano para fijar versiones
  y evitar prompts interactivos; el repo es reproducible sin CLI.
- **ORM / Prisma**: el dashboard arranca sin base de datos (store en memoria +
  semilla). Añadir un ORM antes de tener un modelo estable habría sido coste sin
  beneficio. Ver `docs/03-bases-de-datos.md` para la ruta de migración.
- **shadcn CLI**: los componentes se escribieron a mano para que el repo no
  dependa de la red ni de la versión del CLI.
- **Estado global (Zustand/Redux)**: no hace falta. El estado de servidor lo
  lleva React Query y el borrador del guion vive en `localStorage`.

---

## 3. Estructura

```
app/
  layout.tsx                      # html, fuentes, Providers
  globals.css                     # tokens de diseño (HSL) + utilidades
  page.tsx                        # redirige a /hooks
  (dashboard)/
    layout.tsx                    # shell: sidebar @tenfoldmarc + main
    hooks|analytics|competitors|scheduler|calendar|trends|script|settings/page.tsx
  api/
    status, hooks, hooks/[id], analytics, accounts, competitors,
    competitors/[id], competitors/reels/[id]/save, trends,
    captions, schedule, calendar, settings
    ai/script, ai/hooks, ai/rewrite
    cron/competitors, cron/trends
components/
  ui/                             # primitivos shadcn
  app-sidebar, nav-config, page-header, stat-card, empty-state,
  platform-icon, providers, theme-toggle
  hooks|analytics|competitors|scheduler|calendar|trends|script|settings/  # features
lib/
  utils.ts                        # cn() + formateadores es-ES
  zernio/                         # cliente tipado de la API de Zernio
    client.ts config.ts types.ts accounts.ts posts.ts analytics.ts media.ts
  domain/                         # modelo propio
    types.ts hook-patterns.ts hook-engine.ts analytics-service.ts
    repository.ts zernio-gateway.ts seed/
  services/                       # caption, IA, transcripción, calendario, clasificador
    ai.ts captions.ts transcription.ts calendar-service.ts trend-classifier.ts
  server/                         # sólo servidor
    settings-store.ts cron-auth.ts
  client/script-draft.ts          # sólo cliente (localStorage)
scripts/                          # ingesta manual por CLI (tsx)
docs/                             # documentación funcional y técnica
```

### Regla de frontera servidor/cliente

- `lib/zernio/config.ts` y `lib/server/*` usan `node:fs`. **Ningún componente
  cliente puede importarlos** (arrastraría `fs` al bundle). Su consumo está
  limitado a Server Components y Route Handlers.
- Los componentes cliente consumen datos por `fetch` a `/api/*`.
- Los tipos puros viven en `lib/domain/types.ts` y `lib/zernio/types.ts`, que sí
  son seguros en cliente.

---

## 4. Decisiones clave

### 4.1 Zernio es la fuente de verdad de publicaciones y métricas

`lib/domain/zernio-gateway.ts` es la **única** puerta a Zernio desde la UI.
Cada función devuelve `{ data, source: "zernio" | "demo", warning? }`.

- `DEMO_MODE` (`auto | on | off`, ajustable en `/settings`) decide el origen.
  En `auto` se usa la demo cuando no hay API key, de modo que el dashboard
  **siempre es navegable** en una máquina recién clonada.
- Si la API real falla (401, 403 sin add-on de Analytics, 429, 5xx) se degrada a
  la demo y se devuelve el motivo en `warning`; la página muestra el dato en vez
  de romperse.
- Los datos semilla son **deterministas** (PRNG con semilla fija en
  `lib/domain/seed/analytics.ts`), así que los destacados y el top 5 son
  reproducibles en capturas y tests.

### 4.2 Separación de datos: Zernio vs. store propio

Zernio cubre cuentas, posts y analíticas. **No** cubre biblioteca de hooks,
competidores, tendencias ni el plan de contenido. Esos viven en
`lib/domain/repository.ts`, un store en memoria colgado de `globalThis`
(sobrevive al hot-reload y se comparte entre route handlers del proceso).

Toda la API del repositorio es **asíncrona a propósito**: migrar a Postgres no
obliga a tocar ni un llamador.

### 4.3 Motor de hooks determinista (sin LLM)

`lib/domain/hook-engine.ts` clasifica cualquier texto libre contra 14 plantillas
del catálogo usando reglas de tipo (regex fuerte/débil), bonus estructural y
desempate por rendimiento histórico. Devuelve `patternId`, `type` y
`confidence`.

Motivo: la clasificación tiene que ser **explicable y gratis** porque se ejecuta
al guardar cada hook. El LLM se reserva para la *generación* (guiones, captions,
variaciones), no para la *clasificación*.

### 4.4 IA: un único punto de entrada con degradación

`lib/services/ai.ts` expone `aiComplete()` sobre OpenAI y Anthropic, y funciones
de alto nivel (`generateScript`, `generateHookVariants`, `rewriteCaption`) que
**nunca lanzan**: si el proveedor falla o es `heuristic`, devuelven un resultado
local válido más un campo `note` explicando el fallback.

Decisión: la UI nunca debe quedarse sin respuesta por un 429 de un tercero. El
proveedor por defecto es `heuristic` (plantillas locales, coste cero).

### 4.5 Credenciales: panel + variables de entorno

`/settings` permite conectar Zernio y el modelo de IA sin tocar archivos.
`lib/server/settings-store.ts` las persiste en `.data/settings.json` con
permisos `0600`.

- **Precedencia**: valor del panel > variable de entorno > defecto. Cada campo
  expone su `source` (`file | env | unset`) y la UI lo muestra, para que no haya
  ambigüedad sobre qué clave está activa.
- **Lectura síncrona y cacheada** (`fs.readFileSync` + caché de módulo) para no
  tener que hacer asíncronos los getters de configuración ya existentes.
- **Nunca se devuelven secretos al navegador**: `GET /api/settings` sólo manda
  una versión enmascarada (`sk_abc••••••••1234`) y un booleano `configured`.
- En disco efímero (Vercel) la escritura puede fallar: se captura y se devuelve
  `persisted: false` con un aviso que recomienda variables de entorno. La
  configuración sigue activa en memoria para esa instancia.

### 4.6 Idempotencia en la publicación

`POST /api/schedule` → `lib/zernio/posts.ts` envía siempre la cabecera
`x-request-id`. Zernio deduplica por hash de contenido durante 24 h, así que un
reintento devuelve **el mismo post** en lugar de duplicarlo. Es la razón por la
que el botón de publicar se puede pulsar dos veces sin miedo.

### 4.7 Modo demo con contrato real

`lib/domain/zernio-gateway.ts#simulatePost` construye el post que Zernio
devolvería (mismo shape: `_id`, `status`, `platforms[]`) cuando no hay
credenciales. Así el Programador muestra el flujo real (`scheduled` →
`pending` → `published`) sin tocar la red, y la UI no necesita ramas de demo.

### 4.8 Detección de contenido destacado

Regla en `lib/domain/analytics-service.ts`: se calcula la media de `views` de los
posts publicados en los **últimos 30 días** (`baseline30d`) y se marca como
destacado todo post con `views >= 2 × baseline`. El umbral está exportado como
`STANDOUT_THRESHOLD`.

Las explicaciones del top 5 **no son texto fijo**: se redactan desde señales
medibles (multiplicador sobre la media, tasa de guardado, ratio de compartidos,
engagement y el tipo de hook detectado).

### 4.9 Modo oscuro con acentos terracota

Tema oscuro **por defecto** (`defaultTheme="dark"`, `enableSystem={false}`). Los
tokens son variables HSL en `app/globals.css` con dos juegos (claro y `.dark`) y
la marca en terracota:

- `--primary: 16 62% 56%` en oscuro (≈ `#d9694a`), aclarado respecto al claro
  (`16 55% 50%`) para cumplir contraste AA sobre fondo oscuro.
- Escala completa `terracotta-50 … 950` en `tailwind.config.ts` para usos
  puntuales.
- Superficies **cálidas** (matiz 24, no gris neutro) para que el oscuro no se
  sienta azulado junto al terracota.
- El `<html>` lleva la clase `dark` fija y `suppressHydrationWarning` para
  evitar el flash de tema claro en la primera pintura.

### 4.10 Fechas y zonas horarias

Zernio interpreta `scheduledFor` como hora de pared en la `timezone` enviada y
devuelve UTC. El Programador envía `YYYY-MM-DDTHH:mm:00` + `timezone` (por
defecto `America/Mexico_City`, configurable). El calendario agrupa por fecha
local del navegador. Los cron de Vercel se declaran en **UTC** (ver 4.11).

### 4.11 Ingesta programada

- `GET /api/cron/competitors` → domingos. El requisito es «domingos a las 6am»;
  `vercel.json` lo declara como `0 12 * * 0` **UTC**, que son las 06:00 en
  UTC-6 (México). Si cambias de zona, ajusta el cron.
- `GET /api/cron/trends` → diario a las 13:00 UTC.
- Ambos se protegen con `CRON_SECRET` (`lib/server/cron-auth.ts`). Sin la
  variable, quedan abiertos para poder probarlos con `curl` en local.

### 4.12 Clasificación de tendencias

`lib/services/trend-classifier.ts` calcula un `hookScore` 0-100 ponderando
novedad (0.35), concreción numérica (0.25), tensión (0.25) y autoridad de la
fuente (0.15), y lo proyecta al rango 30-99. Es deterministico y auditable; no
consume tokens.

### 4.13 Extracción de hooks en la transcripción

`lib/services/transcription.ts#extractHook` toma la primera frase con carga
semántica descartando muletillas de apertura («hola», «en este video»…). El
proveedor por defecto es `mock`, que genera una transcripción plausible para que
la demo funcione sin coste.

---

## 5. Comandos

```bash
npm install --include=dev     # ojo: NODE_ENV=production omite devDependencies
npm run dev                   # http://localhost:3000
npm run build && npm start    # producción
npm run check                 # typecheck + lint
npm run ingest:trends         # lectura manual de los 12 feeds
npm run ingest:competitors    # demo del pipeline de transcripción
```

> **Aviso de entorno**: si `NODE_ENV=production` está definido en tu shell, npm
> omite las devDependencies y `tsc`/`eslint` no existen. Usa
> `npm install --include=dev`.

---

## 6. Convenciones de código

- **Idioma**: identificadores en inglés, textos de UI y comentarios en español.
- **Comentarios**: sólo donde la intención no es evidente (reglas de negocio,
  decisiones, motivos). Nunca comentarios que repitan el código.
- **Errores**: en los bordes (route handlers) se validan con Zod y se devuelve
  `{ error }` con el status correcto. En el interior se confía en los tipos.
- **Estado**: React Query para datos de servidor, `useState` para UI,
  `localStorage` sólo para el borrador del guion.
- **Componentes**: un archivo por feature en `components/<feature>/`; los
  primitivos van a `components/ui/`.
- **Accesibilidad**: `aria-label` en botones de icono, `aria-current` en la
  navegación, foco visible con `ring` en todos los interactivos.

---

## 7. Estado actual y siguiente paso

Funcional y verificado: `npm run build` limpio, `tsc --noEmit` sin errores,
`eslint .` sin warnings, y todos los endpoints probados contra el servidor de
producción (incluido el 401 real de Zernio con clave inválida).

Lo que falta para producción real:

1. **Conectar credenciales** en `/settings` (Zernio + proveedor de IA).
2. **Sustituir el store en memoria por una base de datos** si va a haber más de
   una instancia (ver `docs/03-bases-de-datos.md`).
3. **Implementar el pipeline real de competidores** (los pasos están enumerados
   en `app/api/cron/competitors/route.ts` y en `docs/06-integraciones.md`).
4. **Añadir autenticación** si el dashboard se expone en internet.

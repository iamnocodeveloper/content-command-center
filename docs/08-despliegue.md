# 08 · Despliegue

## Requisitos

- **Node.js ≥ 20** (probado en 24).
- npm 10+.
- Nada más para el modo demo: no hace falta base de datos ni credenciales.

---

## Local

```bash
npm install --include=dev
cp .env.example .env.local        # opcional
npm run dev                       # http://localhost:3000
```

> **Aviso importante**: si tu shell tiene `NODE_ENV=production`, npm **omite las
> devDependencies** y `tsc`/`eslint` desaparecen. Usa siempre
> `npm install --include=dev` en desarrollo.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build (requiere `npm run build` antes) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint 9 (flat config) |
| `npm run check` | typecheck + lint |
| `npm run ingest:trends` | Lectura manual de los 12 feeds por CLI |
| `npm run ingest:competitors` | Demo del pipeline de transcripción |

---

## Variables de entorno

Todas son **opcionales**: el panel `/settings` cubre lo mismo. Precedencia:
**valor del panel > variable de entorno > defecto**.

| Variable | Para qué | Obligatoria |
|---|---|---|
| `ZERNIO_API_KEY` | Cuentas, posts y analíticas reales | No (modo demo) |
| `ZERNIO_PROFILE_ID` | Perfil que agrupa las cuentas | Recomendada |
| `ZERNIO_DEFAULT_TIMEZONE` | Zona por defecto al programar | No (`America/Mexico_City`) |
| `ZERNIO_BASE_URL` | Sobrescribir la base de la API | No |
| `DEMO_MODE` | `true` / `false` | No (`auto`) |
| `CAPTION_PROVIDER` | `heuristic` / `openai` / `anthropic` | No (`heuristic`) |
| `OPENAI_API_KEY` | Modelo de IA y Whisper | No |
| `OPENAI_MODEL` | Modelo de OpenAI | No (`gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | Modelo de IA | No |
| `ANTHROPIC_MODEL` | Modelo de Anthropic | No (`claude-sonnet-4-5`) |
| `TRANSCRIPTION_PROVIDER` | `mock` / `openai` / `deepgram` | No (`mock`) |
| `DEEPGRAM_API_KEY` | Transcripción con Deepgram | No |
| `CRON_SECRET` | Protege `/api/cron/*` | **Sí en producción** |
| `DATA_DIR` | Directorio de `settings.json` | No (`.data`) |
| `DATABASE_URL` | Reservado para la migración a Postgres | No |

---

## Docker

El repo incluye un `Dockerfile` multi-etapa con `output: "standalone"` de Next,
que produce una imagen mínima.

```bash
docker build -t content-command-center .
docker run -p 3000:3000 \
  -e ZERNIO_API_KEY=sk_... \
  -e CRON_SECRET=una-cadena-larga \
  -v ccc-data:/app/.data \
  content-command-center
```

El volumen `ccc-data` es lo que hace **persistentes** las credenciales guardadas
desde `/settings`. Sin él, se pierden al recrear el contenedor.

### Con docker compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      ZERNIO_API_KEY: ${ZERNIO_API_KEY}
      ZERNIO_PROFILE_ID: ${ZERNIO_PROFILE_ID}
      CRON_SECRET: ${CRON_SECRET}
      CAPTION_PROVIDER: openai
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      TZ: America/Mexico_City
    volumes:
      - ccc-data:/app/.data
    restart: unless-stopped

volumes:
  ccc-data:
```

### Cron en Docker

Vercel Cron no existe fuera de Vercel. Añade `cron` al `Dockerfile` o usa el cron
del host:

```cron
# Domingo 06:00 (hora del host) → competidores
0 6 * * 0 curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/competitors

# Diario 07:00 → tendencias
0 7 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/trends
```

Ajusta `TZ` en el contenedor o la expresión para que coincida con tu zona.

---

## Vercel

1. Importa el repositorio. Vercel detecta Next.js y no hace falta configuración
   de build.
2. **Environment Variables** → añade al menos `ZERNIO_API_KEY`,
   `ZERNIO_PROFILE_ID` y `CRON_SECRET` (Production y Preview).
3. Deploy. `vercel.json` ya declara los dos cron.

### Consideración clave: el sistema de archivos es efímero

En Vercel (y en cualquier serverless), `.data/settings.json` **no persiste** entre
invocaciones. Por eso:

- Usa **variables de entorno** en lugar del panel `/settings` para las
  credenciales en producción. La precedencia está pensada para esto: si no hay
  valor guardado en el panel, manda la variable.
- El panel seguirá funcionando para *probar* conexiones, pero el guardado
  devolverá `persisted: false` con un aviso (la config queda activa sólo en esa
  instancia y en memoria).
- Si necesitas gestión de credenciales desde la UI en serverless, migra a base de
  datos (ver `docs/03-bases-de-datos.md`, tabla `app_settings`) o usa el
  almacén de secretos de tu plataforma.

### Cron en Vercel

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/competitors", "schedule": "0 12 * * 0" },
    { "path": "/api/cron/trends", "schedule": "0 13 * * *" }
  ]
}
```

**Las expresiones son UTC.** `0 12 * * 0` = domingo 12:00 UTC = **06:00 en UTC-6**
(México). Si tu zona es UTC-5, usa `0 11 * * 0`.

Vercel añade `Authorization: Bearer $CRON_SECRET` automáticamente cuando la
variable existe. Los cron de Vercel tienen límite de duración: el de competidores
está marcado con `maxDuration = 300`.

---

## Checklist de producción

- [ ] `ZERNIO_API_KEY` con permisos sobre el perfil correcto.
- [ ] `ZERNIO_PROFILE_ID` verificado con *Probar conexión* en `/settings`.
- [ ] Cuentas conectadas en Zernio (`GET /v1/accounts` devuelve algo).
- [ ] Add-on de **Analytics** activo si se quieren seguidores y métricas
      completas.
- [ ] `CRON_SECRET` definido (si no, `/api/cron/*` queda público).
- [ ] `npm run check` y `npm run build` en verde.
- [ ] Almacenamiento persistente para `.data` **o** credenciales sólo por
      variables de entorno.
- [ ] **Autenticación** si el dashboard está expuesto en internet.
- [ ] Proveedor de IA decidido y probado (o asumido el heurístico).
- [ ] Copia de seguridad de la base de datos si se migró (ver doc 03).

---

## Notas de seguridad

- Las credenciales guardadas en `.data/settings.json` van con permisos `0600` y
  **nunca** se envían al navegador: `GET /api/settings` sólo devuelve una versión
  enmascarada.
- `.data/` y `**/settings.json` están en `.gitignore`.
- Las claves de API **nunca** llevan el prefijo `NEXT_PUBLIC_`: sólo se leen en
  servidor.
- Todas las llamadas a terceros salen del servidor; el navegador sólo habla con
  `/api/*` del propio dominio.
- Si expones el dashboard públicamente, **añade autenticación antes**: ahora mismo
  cualquiera con la URL podría publicar en tus cuentas conectadas.

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `tsc: command not found` | `NODE_ENV=production` al instalar | `npm install --include=dev` |
| Todo muestra «datos de demostración» | Sin API key o `DEMO_MODE=on` | Conecta Zernio en `/settings` |
| «La clave no tiene permisos sobre este perfil» | API key con ámbito restringido | Revisa el perfil de la clave en Zernio |
| Métricas vacías pero todo lo demás funciona | Falta el add-on de Analytics | Actívalo en Zernio |
| Seguidores a 0 | Igual que arriba (`follower-stats` lo requiere) | — |
| El guardado en `/settings` no persiste | Disco efímero (Vercel) | Usa variables de entorno |
| El cron devuelve 401 | `CRON_SECRET` definido pero cabecera ausente | Añade `Authorization: Bearer …` |
| Los posts se duplican | No se envió `x-request-id` | El cliente del dashboard ya lo envía; revisa llamadas externas |
| Build falla sin red | Se añadieron fuentes de Google | El proyecto usa `geist`, self-hosted |
| Los cron no se disparan en Vercel | Plan gratuito (límite de cron) | Añade un servicio externo que llame al endpoint |

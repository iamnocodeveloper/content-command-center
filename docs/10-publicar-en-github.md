# 10 · Publicar en GitHub y desplegar

Guía paso a paso para publicar el proyecto y ponerlo en producción.

---

## Antes de publicar: revisión de seguridad

El repositorio está preparado para ser público, pero conviene verificarlo una vez
antes del primer push.

```bash
# 1. ¿Hay algún archivo de entorno rastreado?
git ls-files | grep -E "\.env($|\.)" || echo "OK: ningún .env versionado"

# 2. ¿Se colaría la configuración local con credenciales?
git status --porcelain --ignored | grep -E "\.data|settings\.json" || echo "OK: nada de .data"

# 3. ¿Hay claves hardcodeadas en el código?
grep -rnE "sk_[A-Za-z0-9]{20,}|sk-ant-|sk-proj-" \
  --include="*.ts" --include="*.tsx" --include="*.md" . \
  --exclude-dir=node_modules --exclude-dir=.next \
  | grep -v "sk_\.\.\." | grep -v "sk-…" || echo "OK: sin claves reales"
```

Qué está ignorado y por qué:

| Patrón | Motivo |
|---|---|
| `.env`, `.env*.local` | Credenciales del entorno |
| `.data/`, `**/settings.json` | Configuración guardada desde `/settings` (contiene claves) |
| `.commandcode/` | Configuración local de la herramienta de desarrollo |
| `node_modules/`, `.next/`, `out/`, `build/` | Artefactos de build |
| `*.tsbuildinfo` | Caché de TypeScript |

---

## 1. Crear el repositorio

### Opción A · con GitHub CLI (recomendado)

```bash
git init
git add .
git commit -m "feat: Content Command Center, dashboard de contenido sobre la API de Zernio"

gh repo create content-command-center \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Dashboard de contenido para creadores sobre la API de Zernio. Hooks, analíticas, competidores, programación multiplataforma, calendario y tendencias de IA."
```

`--source=.` usa el directorio actual y `--push` hace el primer push en el mismo
comando. Después:

```bash
gh repo edit --add-topic nextjs,typescript,tailwindcss,shadcn-ui,zernio,social-media,dashboard,content-creation,ai
```

### Opción B · manual

```bash
git init
git add .
git commit -m "feat: Content Command Center"

git remote add origin https://github.com/TU-USUARIO/content-command-center.git
git branch -M main
git push -u origin main
```

---

## 2. Configurar el repositorio

```bash
# Descripción y web (útil si luego despliegas)
gh repo edit --description "Dashboard de contenido para creadores sobre la API de Zernio"
gh repo edit --homepage "https://tu-dominio.vercel.app"

# Temas: mejoran el descubrimiento
gh repo edit --add-topic nextjs,typescript,tailwindcss,shadcn-ui,zernio,dashboard

# Activa el análisis de código (gratis en repos públicos)
gh api -X PATCH "repos/:owner/:repo" -f "security_and_analysis[secret_scanning][status]=enabled"
```

---

## 3. Añadir CI (ya incluido)

`.github/workflows/ci.yml` se activa solo al llegar a `main`:

- **Typecheck** → `tsc --noEmit`
- **Lint** → `eslint .`
- **Build** → `next build` (sin credenciales, en modo demo)
- **Docker build** → sólo en `main`, para no gastar minutos en cada PR

El badge del README apunta ya a:

```
https://github.com/iamnocodeveloper/content-command-center/actions/workflows/ci.yml/badge.svg
```

Si publicas con **otro usuario u otro nombre**, actualiza estas tres referencias:

1. El badge de CI en `README.md`.
2. El badge de deploy de Vercel en `README.md`.
3. El comando `git clone` del arranque rápido.

---

## 4. Desplegar

### Vercel

1. [Importa el repositorio](https://vercel.com/new).
2. **Environment Variables** (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `ZERNIO_API_KEY` | `sk_…` |
   | `ZERNIO_PROFILE_ID` | `66a1f0c2…` |
   | `CRON_SECRET` | una cadena larga y aleatoria |
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio.vercel.app` |
   | `CAPTION_PROVIDER` | `openai` o `anthropic` (opcional) |
   | `OPENAI_API_KEY` | opcional |

3. Deploy. Los cron de `vercel.json` se registran automáticamente.

Genera el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Docker / VPS

```bash
cp .env.example .env
# edita .env: CRON_SECRET obligatorio, ZERNIO_API_KEY recomendado
docker compose up -d --build
```

Para los cron fuera de Vercel, añádelos al crontab del host:

```cron
0 6 * * 0  curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/competitors
0 7 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/trends
```

---

## 5. Después de publicar

- [ ] El badge de CI se pone en verde.
- [ ] La tarjeta social se ve bien: pega la URL del repo en un chat y comprueba la
      previsualización (la imagen la genera `app/opengraph-image.tsx`).
- [ ] Haz una release etiquetada:

      ```bash
      git tag -a v1.0.0 -m "Primera versión pública"
      git push origin v1.0.0
      gh release create v1.0.0 --generate-notes
      ```

- [ ] Revisa que el panel de seguridad no reporte alertas de dependencias.
      ```bash
      gh api repos/:owner/:repo/dependabot/alerts --jq 'length'
      ```

---

## 6. Si el repositorio va a ser privado

Cambia el badge de CI (funciona igual en privado) y quita el botón de deploy de
Vercel del README, que asume un repo público clonable.

---

## Nota sobre autenticación

El dashboard **no tiene login**: asume un único creador. Si lo despliegas en una
URL pública, cualquiera que la encuentre podría publicar en tus cuentas
conectadas. Antes de exponerlo:

- Protege el despliegue con la autenticación de la plataforma (Vercel Password
  Protection, Cloudflare Access).
- O añade autenticación en la app (NextAuth, Clerk, o el proveedor de tu
  preferencia) protegiendo el layout de `app/(dashboard)/layout.tsx` y las rutas
  de escritura de `app/api/`.

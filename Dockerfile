# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Content Command Center · imagen de producción multi-etapa
#
# Next.js en modo `standalone` (ver next.config.ts), lo que produce una imagen
# mínima con sólo las dependencias necesarias en runtime.
#
#   docker build -t content-command-center .
#   docker run -p 3000:3000 -v ccc-data:/app/.data content-command-center
#
# El volumen sobre /app/.data hace persistentes las credenciales guardadas
# desde /settings. Sin él se pierden al recrear el contenedor.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
# --include=dev porque el build necesita TypeScript y Tailwind.
RUN npm ci --include=dev

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La configuración se resuelve en runtime, no en build: estas variables sólo
# evitan que el build intente usar valores reales.
ENV DEMO_MODE=true
ENV NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=.data

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Estáticos y artefacto standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Directorio de datos, escribible por el usuario sin privilegios
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data
VOLUME ["/app/.data"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]

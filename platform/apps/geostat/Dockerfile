# Per-app image (node-vite driver) — geostat SPA → static dist served by nginx.
#
# Build context = the pnpm workspace root (platform/). The per-module compose passes
#   build:
#     context: ../../
#     dockerfile: apps/geostat/Dockerfile
# so every COPY below resolves against the workspace root. The Vite build resolves
# @statdash/* via aliases to ../../packages/* SOURCE (no per-package build step), hence the
# whole packages/ tree must be in the build context — copied in the build stage.
#
# pnpm (not npm): the workspace uses the catalog: + workspace:* protocols, which only the
# pnpm resolver understands. corepack pins the version from package.json packageManager.
ARG NGINX_VERSION=1.27-alpine
ARG APP_DEV_PORT=5171

# ─── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# ─── Stage 2: deps (install the @statdash/geostat closure) ─────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Workspace package manifests must exist before a --frozen-lockfile filtered install.
COPY packages/ ./packages/
COPY apps/geostat/package.json ./apps/geostat/
RUN pnpm install --frozen-lockfile --filter ./apps/geostat...

# ─── Stage 3: development (vite dev server, source-mounted by compose override) ─
FROM deps AS development
ARG APP_DEV_PORT
ENV APP_DEV_PORT=${APP_DEV_PORT}
COPY . .
EXPOSE ${APP_DEV_PORT}
CMD ["sh", "-c", "pnpm --filter ./apps/geostat dev -- --host 0.0.0.0 --port ${APP_DEV_PORT}"]

# ─── Stage 4: builder (vite-only build → apps/geostat/dist) ───────────────────
FROM deps AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
# The geostat SPA reads its statistical-data base from VITE_API_STATS_URL
# (src/data/site-manifest.ts) — distinct from VITE_API_URL. Expose it as a build
# arg so the stats API origin is baked into the static bundle at build time.
ARG VITE_API_STATS_URL
ENV VITE_API_STATS_URL=$VITE_API_STATS_URL
COPY . .
# Production packaging runs vite ONLY — never `tsc -b` (type-checking the whole
# monorepo via ../../packages is a category error in a per-app image; the `build`
# script keeps tsc as the local gate). Vite builds @statdash/* from SOURCE; the
# OPTIONAL peer deps of @statdash/plugins (react-leaflet/leaflet/apexcharts/
# react-apexcharts) resolve via explicit resolve.alias in apps/geostat/vite.config.ts
# (require.resolve'd to the app's own installed copies), so the FILTERED deps install
# is sufficient — no full-monorepo re-install.
RUN pnpm --filter ./apps/geostat exec vite build

# ─── Stage 5: production (nginx serving the static dist) ──────────────────────
FROM nginx:${NGINX_VERSION} AS production
COPY --from=builder /app/apps/geostat/dist /usr/share/nginx/html
COPY apps/geostat/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]

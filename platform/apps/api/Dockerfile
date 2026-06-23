# syntax=docker/dockerfile:1
# Build context = the pnpm workspace root (platform/). The api compose files
# (apps/api/docker-compose.{dev,prod}.yml) pass `context: ../../` so every COPY
# path below resolves against platform/.
#
# The api's workspace closure is @statdash/api → @statdash/engine → @statdash/expr
# and @statdash/api → @statdash/contracts. The api is built with
# moduleResolution=NodeNext and an empty `paths` map, so it resolves those
# packages via node_modules → their `exports` → dist/*.d.ts (build time) and
# dist/*.js (runtime). Therefore the engine package set must be built to dist
# BEFORE the api's tsc runs, and that dist must travel into the runtime image.
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# ─── Stage 1: install the @statdash/api dependency closure ─────────────────────
# Copy ONLY manifests first so this layer caches across source-only changes.
# pnpm needs every workspace manifest the closure touches: root + workspace
# config + the api manifest + the three packages it (transitively) depends on.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/expr/package.json     ./packages/expr/
COPY packages/core/package.json     ./packages/core/
RUN pnpm install --frozen-lockfile --filter @statdash/api...

# ─── Stage 2: build engine packages → api dist ────────────────────────────────
# Bring installed node_modules forward, then copy source for the closure only.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/expr/node_modules     ./packages/expr/node_modules
COPY --from=deps /app/packages/core/node_modules     ./packages/core/node_modules
# Root config (api tsconfig.build.json → tsconfig.json → ../../tsconfig.json)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
# Package source for the api closure (manifests already present from deps copy
# would be overwritten identically here — fine).
COPY packages/contracts ./packages/contracts
COPY packages/expr      ./packages/expr
COPY packages/core      ./packages/core
COPY apps/api           ./apps/api
# Build the engine closure to dist in dependency (topological) order, then the
# api. `--filter @statdash/api^...` selects the api's DEPENDENCIES (not the api
# itself) in topo order; that builds contracts → expr → core. Then build api.
RUN pnpm --filter "@statdash/api^..." run build \
 && pnpm --filter @statdash/api run build

# ─── Stage 3: production runtime ──────────────────────────────────────────────
# Ship the api dist + the node_modules graph (which symlinks the @statdash/*
# packages → their dist, copied via the package dirs below).
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
# Built dist of the workspace deps the runtime import graph reaches.
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/packages/expr/dist ./packages/expr/dist
COPY --from=build /app/packages/expr/package.json ./packages/expr/
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
# node_modules (incl. the workspace symlinks under node_modules/@statdash/*).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/core/node_modules ./packages/core/node_modules
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]

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

# ─── Stage 2b: pnpm deploy → flattened, self-contained runtime dir ────────────
# WHY NOT just COPY node_modules into the runtime stage:
#   This workspace uses pnpm's default ISOLATED node-linker (.npmrc:
#   shamefully-hoist=false, no node-linker override → the .pnpm virtual store).
#   Under that linker, node_modules/@statdash/* and every external dep are
#   SYMLINKS into .pnpm/<pkg>@<ver>/node_modules/<pkg>. A hand-picked COPY of a
#   few package dirs + node_modules cannot reliably reproduce that symlink web in
#   the runtime image: copying a symlink without its .pnpm target (or copying
#   .pnpm partially) yields dangling links → MODULE_NOT_FOUND at boot. That is
#   the flagged runtime-resolution fragility.
#
# THE ROBUST FIX — `pnpm deploy`:
#   `pnpm deploy --filter @statdash/api --prod /deploy` resolves the api's
#   FULL production dependency closure and writes a STANDALONE directory with
#   every dependency INLINED under deploy/node_modules — workspace packages
#   (@statdash/contracts|expr|engine, copied per their `files:['dist']`) and
#   external prod deps alike, as real directories, NO symlinks into a virtual
#   store. The result is a self-contained app that `node dist/index.js` runs
#   from any base image with zero pnpm/.pnpm runtime assumptions.
#   Prereq satisfied above: the engine + api dist already exist (deploy copies
#   the built `dist`, never source).
#
#   --legacy is passed because pnpm@9 gates `deploy` outside a workspace behind
#   it unless inject-workspace-packages is enabled; --legacy keeps it working
#   for the standard workspace:* deps here. --prod drops devDependencies (tsx,
#   typescript, @types/*) so the runtime image carries only what boot needs.
#   Target /deploy is OUTSIDE the workspace tree (/app): pnpm 9 refuses a deploy
#   target nested inside the project, so it lives at the image root.
RUN pnpm --filter @statdash/api --prod --legacy deploy /deploy

# ─── Stage 3: production runtime ──────────────────────────────────────────────
# Ship ONLY the flattened deploy dir produced above. No pnpm, no .pnpm store, no
# workspace symlinks — a single self-contained tree. `dist/index.js` + an inlined
# node_modules is everything `node` needs.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# The deploy dir is the api package root: package.json + dist + node_modules
# (all deps inlined). Copy it verbatim as the app root.
COPY --from=build /deploy ./
EXPOSE 3001
# Run as the unprivileged node user baked into node:22-alpine (least privilege).
USER node
CMD ["node", "dist/index.js"]

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

# ─── Stage 1: build — install closure, then compile in dependency order ───────
# A SINGLE build stage. We deliberately do NOT split a separate "deps" stage that
# forwards node_modules with per-package `COPY --from=deps .../node_modules`:
# under pnpm's isolated linker, ZERO-DEPENDENCY packages (@statdash/expr,
# @statdash/contracts) get NO node_modules directory at all, so such a COPY fails
# with "not found". Instead we run `pnpm install` HERE and let pnpm create
# whatever node_modules shape it wants (root .pnpm store + symlinks); the
# Dockerfile never assumes a per-package node_modules exists.
FROM base AS build

# Manifests first so this layer caches across source-only changes. pnpm needs
# every workspace manifest the closure touches: root + workspace config + the
# api manifest + the three packages it (transitively) depends on.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/api/package.json          ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/expr/package.json      ./packages/expr/
COPY packages/core/package.json      ./packages/core/

# Install the @statdash/api dependency closure (`...` = api + everything it needs).
RUN pnpm install --frozen-lockfile --filter @statdash/api...

# Now bring in source for the closure only (after install → cache-friendly).
COPY packages/contracts ./packages/contracts
COPY packages/expr      ./packages/expr
COPY packages/core      ./packages/core
COPY apps/api           ./apps/api

# Build the engine closure to dist in dependency (topological) order, then the
# api. `--filter "@statdash/api^..."` selects the api's DEPENDENCIES (not the api
# itself) in topo order → contracts → expr → core. Then build the api itself,
# whose tsc resolves the just-built dist of each dependency.
RUN pnpm --filter "@statdash/api^..." run build \
 && pnpm --filter @statdash/api run build

# ─── Stage 2: production runtime — ship the built workspace ───────────────────
# `pnpm deploy` is version-fragile (the pinned pnpm@9.15 rejects --legacy, and the
# new-deploy path needs inject-workspace-packages) so we ship the built workspace
# directly: the api's dist + the engine packages' dist + the resolved node_modules
# (the .pnpm store and the workspace symlinks). The @statdash/* symlinks in
# node_modules are RELATIVE (node_modules/@statdash/engine -> ../../packages/core),
# so they resolve within the copied tree; node finds every dep with no pnpm at
# runtime. Larger than a `pnpm deploy` slim dir — a future optimization once the
# pnpm-deploy version story is pinned; correctness first.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# The whole resolved dependency graph (incl. .pnpm store + workspace symlinks).
COPY --from=build /app/node_modules ./node_modules
# Symlink targets: the engine packages (their built dist) + their package.json.
COPY --from=build /app/packages ./packages
# The api itself (its built dist + package.json + node_modules symlinks).
COPY --from=build /app/apps/api ./apps/api
# Workspace root manifests so pnpm-workspace symlink resolution stays valid.
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
WORKDIR /app/apps/api
EXPOSE 3001
# Run as the unprivileged node user baked into node:22-alpine (least privilege).
USER node
CMD ["node", "dist/index.js"]

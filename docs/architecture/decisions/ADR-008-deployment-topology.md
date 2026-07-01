---
title: Deployment Topology (per-app single-origin reverse proxy)
status: Proposed
date: 2026-06-25
authors: architect (Opus)
migrated_from: adr_deployment_topology
---

# ADR-008 — Deployment Topology

**Status:** Proposed (per-app single-origin reverse-proxy deployment).

## Context

The SPA and API are deployed as separate origins, which forced CORS `'*'`, a served-file CSP patch, local-build mounts, and three origins to coordinate. Two root causes were found: RC-1 the image `tsc -b` type-checks the whole `../../packages` tree so peer-deps (ajv/react-router-dom/i18next/apexcharts) are unresolved under a `shamefully-hoist=false` filtered install; RC-2 the SPA's `?? 'http://localhost:3001'` fallback defeats a relative base.

## Decision

- **Per-app reverse-proxy single-origin:** nginx serves the SPA and proxies `/api/` to the INTERNAL api; empty `VITE` base → relative `/api/`. Kills CORS `'*'`, the served-file CSP patch, local-build mounts, and the three-origin problem.
- **RC-1 fix:** a vite-only build stage (drop `tsc -b` from the image; typecheck in CI) — NOT a global hoist and NOT a second full install band-aid.
- **RC-2 fix:** the SPA fallback must become `''` (a frontend src change) so the relative base holds.
- **D3:** CORS `origin:false` prod default; CSP `frame-ancestors` is header-only (a meta tag cannot loosen it — intersection/most-restrictive wins).

## Rejected Alternatives

1. **A2 — unified subpath (panel `basename` + external-product routing)** — REJECTED: couples the external panel product's routing to the deployment; single-origin per app is simpler and keeps the panel independently deployable.
2. **A5 — global pnpm hoist to resolve peer-deps** — REJECTED: fixes the symptom (unresolved peers) by weakening isolation; the root cause is `tsc -b` in the image, fixed by a vite-only build stage.
3. **Keep multi-origin + CORS `'*'` + CSP served-file patch** — REJECTED: three origins, a wildcard CORS, and patching CSP into served files are all symptom patches of the missing reverse proxy.

## Consequences

- Positive: one origin per app, no wildcard CORS, CSP meta unpatched, clean image build.
- Negative / cost: requires an nginx reverse-proxy per app and a frontend fallback change; typecheck moves to CI.
- Fitness functions: `FF-SAME-ORIGIN`, `FF-NO-WILDCARD-CORS`, `FF-IMAGE-BUILDS-CLEAN`, `FF-CSP-META-UNPATCHED`.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# ADR — statdash-platform Production Deployment Topology

Status: PROPOSED (architect). Read-only audit; this memory + the implementation spec below are the deliverable. No code/compose written.

## Context

Live LAN demo stood up with four hacks that must be replaced by a canonical production deployment:
1. **3 separate origins** (front `:3002`, panel `:3003`, api `:3001`) → forces cross-origin calls.
2. **CORS_ORIGIN='*'** on the api (permissive) — only because the SPAs call cross-origin.
3. **CSP `connect-src`** hand-patched on the *served* `index.html` to whitelist the http api origin — ephemeral, lost on rebuild.
4. **Local `pnpm build` + ad-hoc `nginx:alpine` mount** — not reproducible; the per-app Docker images **do not build** (`tsc -b` cannot resolve peer-deps under strict isolation).

The platform itself is ship-ready (DEPLOY.md: 1454 tests on real TimescaleDB; api boots in `NODE_ENV=production`, fail-fast env gate verified live; Flyway V1→V31).

## Two root causes found in the real code (load-bearing — the whole design hinges on these)

### RC-1 — Why the image `tsc -b` fails but local `pnpm build` passes

Both app Dockerfiles' **builder** stage runs `tsc -b && vite build` (via `pnpm --filter ./apps/X build`). `tsc -b` is a **project-references** build: `apps/geostat/tsconfig.app.json` has `"include": ["src", "../../packages"]` — it compiles the **entire `packages/` source tree** (react, plugins, charts, +their referenced graph), not just the app. Those package sources import bare specifiers (`react-router-dom`, `i18next`, `react-apexcharts`, `apexcharts`, `ajv`, `leaflet`, `react-leaflet`) that the packages declare as **`peerDependencies`** (see `packages/react/package.json` peers react-router-dom/i18next; `packages/plugins/package.json` peers react-apexcharts/leaflet/react-leaflet; **`ajv` is a plugins `devDependency`**).

Under `.npmrc shamefully-hoist=false` (strict isolation), a peer dep is resolved **only if some package in the install closure declares it as a direct `dependency`**. The deps stage runs `pnpm install --frozen-lockfile --filter ./apps/X...` — the app closure. Locally, `pnpm build:geostat`/`build:panel` pass because the developer first ran a **full workspace install** that hoisted every dependency into the workspace store; the filtered image install does not.

- **geostat** declares react-router-dom, i18next, apexcharts, react-apexcharts, leaflet, react-leaflet as direct deps → its peers are satisfiable, **but** `tsc -b` still compiles `packages/plugins` test/source that touches `ajv` (a plugins *devDep*, never installed in the app closure) → resolution gap.
- **panel** declares react-apexcharts/apexcharts/leaflet/react-leaflet/i18next/react-router-dom too, **but** likewise never gets `ajv`, and any package peer not also an app direct-dep is unresolved.

The current Dockerfiles already paper over this with a **second `pnpm install --frozen-lockfile`** (full, unfiltered) in the builder stage (geostat line 52, panel line 47). That *works* but is a band-aid: it re-installs the whole workspace inside the image (slow, defeats the filtered-closure intent) and still depends on `tsc -b` having every transitive peer. It is not the canonical fix.

**Canonical fix = stop type-checking the world in the production image build.** The image's job is to emit a correct bundle, not to be the typecheck gate (that is CI's job). Use a **vite-only build** in the image (`vite build`, no `tsc -b`); pair it with the full install only of what the *bundler graph* actually imports. This is RC-1's true root cause: `tsc -b` over `../../packages` is a **type-check of the entire monorepo**, structurally wrong for a per-app production image. (Detail + ranked alternatives in the spec.)

### RC-2 — The SPA URL contract does NOT yield relative `/api/...` on empty base

The task premise ("EMPTY base → relative `/api/...`") is **false against current code**. All three call sites hardcode a fallback:
- `apps/panel/src/lib/auth.ts:16` — `import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`
- `apps/panel/src/lib/api.ts:28` — same
- `apps/geostat/src/data/site-manifest.ts:142,185` — `VITE_API_STATS_URL ?? 'http://localhost:3001'`

So an empty/undefined env var resolves to `http://localhost:3001` (absolute, cross-origin), **not** to `''` (relative). For the single-origin design, the fallback must become `''` (empty string) so `\`${BASE}/api/...\`` → `/api/...` (same-origin). This is a required source change, owned by the frontend specialist. Without it, the entire CORS-elimination collapses.

(Note: `auth.ts` posts to `/api/auth` while the api mounts `authRoutes` at `/api/auth` with a `/login`-style body — the existing path contract is unchanged by this ADR; only the BASE changes.)

## Decision

### D1 — Origin topology: **per-app reverse proxy, single-origin per app, api internal** (CHOSEN)

Each app image's nginx serves the SPA at `/` AND `proxy_pass`es `/api/` → the internal `statdash-api` container (container-DNS `http://statdash-api:3001`). The api is **not published** to the host. SPAs use a **relative** api base (`VITE_API_URL=''`, `VITE_API_STATS_URL=''` → `/api/...`).

Consequences:
- **CORS dies** — every request is same-origin. The api `CORS_ORIGIN` default becomes a no-op (set restrictive; see D3).
- **CSP `connect-src 'self'` works unchanged** — revert the served-file patch; the meta CSP needs no http-origin whitelist because the api is same-origin.
- **Builds carry no host/IP** — empty base → the bundle is environment-agnostic; the same image runs on LAN, staging, prod (Twelve-Factor: config in env at the proxy, not baked).
- Two published ports only (geostat proxy, panel proxy). api + pg + flyway stay internal on `statdash-net`.

ISO 25010 trade-off: **Security + Portability + Deployability gained** (no permissive CORS, no baked origin, identical image everywhere) at the cost of a slightly larger nginx config per app (an `/api/` upstream block). Accepted — the cost is one location block.

### D2 — Reproducible image build: **vite-only build stage, single full install, drop `tsc -b` from the image** (CHOSEN)

The production image runs `vite build` only (no `tsc -b`). Typecheck stays in CI (`pnpm -r typecheck` / the existing `tsc -b` on developer + CI machines), where it belongs — a fitness gate, not a packaging step. The image install is a single `pnpm install --frozen-lockfile` of the app closure that the **bundler** resolves; because Vite resolves `@statdash/*` via **source aliases** (vite.config alias → `../../packages/*` source), the whole `packages/` tree must be in context (already is) and the bundler pulls only the bare deps it actually imports. `shamefully-hoist=false` stays intact (D2 does not weaken isolation; it stops type-checking the monorepo inside the image).

To make even the bundler-graph peers deterministically present without a second unfiltered install, **the apps declare every bare specifier their bundled graph imports as a direct `dependency`** (proper dependency hygiene — the app IS the integrator that supplies the packages' peers). geostat already does for all but `ajv`; both apps add `ajv` if (and only if) the bundled graph imports it at runtime (grep found **no `ajv` import in plugins src** → it is a *build/test-only* dep of plugins; with `tsc -b` removed from the image, `ajv` is no longer needed in the image at all — confirm in CI). Result: filtered install + vite build, no full re-install band-aid.

ISO 25010 trade-off: **Reproducibility + Build-speed + Maintainability gained** (deterministic, no monorepo typecheck in the image, smaller layers) vs **the image no longer fails on type errors** — accepted because typecheck is a CI fitness function, and a production *packaging* image asserting types is a category error (Separation of Concerns).

### D3 — api CORS + CSP in the new topology

- **CORS**: same-origin → no CORS needed. Change the `env.ts` default from `'http://localhost:5175'` to a value that means "same-origin only". Keep the var (some ops may still want a dev cross-origin allowance), but the **production `.env.prod` sets `CORS_ORIGIN=false`** (Fastify `@fastify/cors` with `origin: false` disables CORS entirely — no `Access-Control-Allow-Origin` emitted, which is correct for same-origin). Never `'*'`.
- **CSP**: stays strict `connect-src 'self'`. **Correct the misconception** in `geostat/index.html` comment (lines 8–16): an nginx `add_header Content-Security-Policy` **cannot loosen** a `<meta>` CSP. Per the CSP spec, when a document has **multiple policies** (one from meta, one from header), each is enforced independently and the result is the **intersection (most-restrictive wins)**. A header can only *further restrict*, never relax, the meta policy. The current ops/compose `nginx.conf` adds a `frame-ancestors` header (line 18) — that is the *one* directive meta cannot express (meta ignores `frame-ancestors`), so the header is the correct home for `frame-ancestors` and X-Content-Type-Options, while `connect-src`/`script-src`/etc. stay in meta. Rewrite the comment to say this.

### D4 — One clean compose

A single root compose (proposed `ops/compose/docker-compose.prod.yml` unified, or a new `ops/compose/stack.prod.yml`) on one network `statdash-net`:
- `statdash-api` — internal only (**no `ports:`**), `env_file ops/config/api/.env.prod`, healthcheck `/health`.
- `statdash-geostat` — built `target: production`, **published** `${GEOSTAT_PORT}:80`, depends_on api healthy.
- `statdash-panel` — built `target: production`, **published** `${PANEL_PORT}:80`, depends_on api healthy.
- `postgres` (TimescaleDB-HA pg16) + `flyway` (gated on `postgres: service_healthy`, V1→V31 + `R__` seed). Internal only.
- Build args for the SPAs set `VITE_API_URL=''` / `VITE_API_STATS_URL=''` (empty → relative, given RC-2 fix).
- Secrets via the fail-fast contract (`.env.prod`, gitignored). Aligns with DEPLOY.md §2–§4.

### D5 — TLS / prod posture (designed-in, not over-built for LAN)

TLS terminates at the **proxy tier**. For the LAN demo: plain http on the two published ports (YAGNI — no certs). For prod: front the two app proxies with **one TLS-terminating edge** (either each app nginx gains a `:443` server block with mounted certs, or — cleaner at scale — a single edge proxy / Caddy / Traefik in front, path- or host-routing to the two app containers). Because the api is already internal and same-origin, **adding TLS changes nothing in the SPA bundle** (relative base is scheme-agnostic) — TLS slots in at the proxy with zero rebuild. That is the payoff of D1.

## Rejected alternatives

- **A2 — Single unified reverse proxy, subpath-routed (`/` geostat, `/panel/` panel, `/api/`).** One published port, one CSP origin. **Rejected for now**: the panel is react-admin (MUI) with its own SPA basename; subpath hosting requires Vite `base: '/panel/'` + react-admin `<Admin basename="/panel">` + asset-path rewrites + history-fallback scoping — real surface area and a Principle-of-Least-Astonishment trap (panel deep-links break subtly). The panel is also an **externally-shipped product** (see [[project_panel_external_product]]) — coupling it to a host subpath erodes that. Per-app origin (D1) keeps each SPA at `/` with zero base/basename gymnastics. **Door**: if a single public hostname is later mandated, A2 becomes an *edge* concern (host-routing `panel.example` vs `app.example`, not path-routing) — still no SPA base change. Documented so the door is named, not lost.
- **A3 — Keep cross-origin + tighten CORS to explicit origins + per-env CSP header.** Rejected: still needs CORS preflight on every api call, still bakes/threads the api origin into the SPA (defeats portability), still fights the meta-CSP-vs-header intersection. D1 removes the *class* of problem (root cause) rather than tuning the symptom (Law 6).
- **A4 — Build-stage full `pnpm install` (the current band-aid) kept as the canonical fix.** Rejected: re-installs the whole workspace in-image, couples packaging to a monorepo-wide typecheck, slow, and still fragile to any new package peer. D2 is the root-cause fix.
- **A5 — `shamefully-hoist=true` (global hoist) to make peers resolve.** **Refused** — weakens the strict-isolation guarantee that keeps the apps split-ready ([[project_geostat_alias_resolution]], [[project_panel_external_product]]); a Golden-Hammer that trades a deliberate architectural invariant for a build convenience. The task explicitly forbids it.
- **A6 — `pnpm deploy` slim runtime for the SPAs.** N/A — SPAs ship as static dist behind nginx; no node runtime. (The api already documents why it ships the built workspace rather than `pnpm deploy`, version-fragility — unchanged.)

## Fitness functions (encode the invariants)

- **FF-SAME-ORIGIN** — grep the built SPA dist for `http://` / `:3001` / any IP literal → MUST be zero (asserts empty base + no baked origin). CI step on the image.
- **FF-NO-WILDCARD-CORS** — `ops/config/api/.env.prod` MUST NOT contain `CORS_ORIGIN='*'`; prod sets `origin: false`.
- **FF-IMAGE-BUILDS-CLEAN** — `docker build` of both app images from a *cold* context (no prior workspace install) succeeds — the reproducibility guarantee RC-1 broke.
- **FF-CSP-META-UNPATCHED** — `geostat/index.html` `connect-src` is exactly `'self'` (no http origin) — asserts the served-file patch is gone and not reintroduced.

## How each step removes a named hack

| Hack | Removed by |
|---|---|
| CORS_ORIGIN='*' | D1 (same-origin) + D3 (`origin: false` prod default) |
| CSP served-file patch (ephemeral) | D1 (api same-origin → `connect-src 'self'` works) + D3 (revert patch, fix comment) |
| Local build + ad-hoc nginx mount | D2 (reproducible image) + D4 (compose builds + serves) |
| Manual `nginx:alpine` containers | D4 (the two app images ARE the proxies, in one compose) |
| 3 separate origins / api publicly exposed | D1 + D4 (api internal, two proxy ports only) |

Related: [[project_panel_external_product]] · [[project_geostat_alias_resolution]] · [[adr_platform_structure_rearchitecture]]

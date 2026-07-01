---
name: adr-platform-structure-rearchitecture
description: ADR — critical re-architecture of platform/ structure; engine/ vs packages/ naming, @geostat→@statdash scope, missing contracts package, laws-vs-reality drift, Strangler-Fig migration
metadata:
  type: project
---

# ADR — Platform Structure Re-architecture (proposed)

Status: PROPOSED · Date: 2026-06-23 · Supersedes naming in [[apps-monorepo-migration]], engine/CLAUDE.md doctrine.

## Context

`platform/` is a pnpm monorepo: `engine/{expr,core,charts,styles,react,plugins}` (libraries, `@geostat/*`) + `apps/{api,geostat,panel}` (deployables). Deps resolve via Vite `resolve.alias` + tsconfig `paths` to **source** (no per-package build for the front); `workspace:*` is declared but `@geostat/*` is NOT in node_modules — aliases are load-bearing (see [[geostat-alias-resolution]]). The dependency arrow `expr ← core ← react ← plugins ← apps` is enforced by `eslint no-restricted-imports` (a real fitness function). 780 tests green, 25 migrations, ADR-0026 SDUI-runner bootstrap mid-flight.

The mandate: critically re-architect against best-in-class standards (Nx/Turborepo conventions, Clean Architecture, DDD package-by-domain), not rubber-stamp.

## What is GOOD (keep — do not churn)

1. **The dependency arrow is a real, enforced fitness function**, not a comment. `eslint.config.js` bans each inner layer from importing outer layers by alias AND relative path; `apps/panel` additionally bans relative reach-ins to `engine/`. This is exemplary — better than most monorepos. KEEP.
2. **Source-condition resolution** (`conditions: ['source', ...]` + `exports.source`) gives zero-build-step DX while keeping a publishable `dist` story. Sound.
3. **The expr/core/react/charts seam is correct DDD package-by-layer.** `expr` (sandboxed expression lang, zero-dep) and `charts` (renderer-agnostic ChartDef→ChartOutput) are genuinely independent capabilities, correctly isolated. The charts split (two registries, [[charts-split-8_1]]) was the right call.
4. **platform ↔ ops split exists**: deploy lives in `ops/` (compose, migrations, config, scripts). Right instinct.
5. **catalog: protocol** single-sources version pins. Correct SSOT.

## DEFECTS (ranked)

### P0 — actively harmful / blocks scaling

- **P0-1 `workspace:*` declared but never installed = latent install-breaker.** Every package.json declares `"@geostat/engine": "workspace:*"`, but resolution is 100% via aliases; `@geostat/*` is absent from node_modules. The day someone runs a clean `pnpm install` expecting workspace linking, or CI builds a package in isolation, the alias illusion and the manifest diverge. SSOT violation: two competing resolution stories. (See [[geostat-alias-resolution]].)
- **P0-2 Missing `@statdash/contracts` (shared types) package.** `apps/api` cannot import `@geostat/react` (Law 3, correct), so it **re-declares** boundary types — `PageDataSnapshot` is duplicated as `{ generatedAt; [k]: unknown }` in `snapshot-store.ts`; bootstrap/provisioning types re-typed. This is the classic "no contracts package" smell: the boundary is enforced by *duplication* instead of a shared, dependency-free `@statdash/contracts` both sides import. DRY + SSOT violation forced by an otherwise-correct arrow.

### P1 — standard-violation

- **P1-1 Laws-vs-reality drift (doctrine describes a phantom tree).** Root `CLAUDE.md` Law 3 says `packages/engine ← packages/react ← plugins ← src`. `engine/CLAUDE.md` is literally titled "# packages/ — Engine + React Layer Orientation" and repeats `packages/engine ← packages/react`. **None of `packages/`, top-level `react/`, or top-level `src/` exist.** Real tree is `engine/{core,react}` + `apps/`. The canonical law documents a structure three renames stale. Principle of Least Astonishment violation; a newcomer following the laws looks for dirs that aren't there.
- **P1-2 `@geostat/*` scope on a multi-tenant platform = first-tenant erosion.** The product is `statdash-platform`; the published library scope is `@geostat/*` — named after the *first tenant*. The panel ships as an external product whose published contract IS these packages (SemVer, [[panel-external-product]]). Shipping `@geostat/engine` as the generic engine bakes the first tenant's name into every external consumer's import statements forever. Cross-confirmed by the standing first-tenant-erosion feedback. The engine, react, charts, expr, styles, plugins packages are tenant-agnostic and must be `@statdash/*`. (`apps/geostat` legitimately stays geostat — it IS the tenant.)
- **P1-3 Dockerfile + nginx.conf inside `apps/<app>/src/`.** `apps/geostat/src/Dockerfile`, `apps/panel/src/Dockerfile`, `apps/geostat/src/nginx.conf`. `src/` is application source; a Dockerfile is a deploy artifact. Deploy concern bleeding into the source tree. Convention: Dockerfile at app root (`apps/geostat/Dockerfile`, as `apps/api/Dockerfile` already correctly does) or in `ops/`. `apps/api` is right; the two front apps are wrong — inconsistent within the same repo.
- **P1-4 `engine/` name fights tooling + newcomer expectation.** Nx, Turborepo, and pnpm-create scaffolds universally use `packages/` + `apps/`. `engine/*` as the package home is an idiosyncratic grouping that (a) every tool's defaults and docs assume away, (b) implies all six packages are "the engine" when `styles`/`expr`/`plugins`/`react` are siblings of the engine, not parts of it. The grouping is real (these are the platform libraries) but the *name* overclaims. `packages/` is the standard; if a domain grouping is wanted, it is a scope (`@statdash/*`), not a directory name.

### P2 — polish / coherence

- **P2-1 Inconsistent package internal layout.** `core/charts/styles/react` use `src/index.ts`; `expr` puts `index.ts` + `ops-catalog.ts` + `refs-catalog.ts` at package root alongside `src/`; `plugins` puts `catalog.ts` + `registry.ts` + slice dirs at root with no `src/`. Three different conventions for "where is the entry." Least Astonishment.
- **P2-2 Test colocation split-brain.** 69 inline `*.test.ts` next to source AND 6 `__tests__/` dirs. Pick one (inline-colocated is the modern default and dominates here). `*.fitness.test.ts` convention is good — keep and standardize it.
- **P2-3 Two compose files** (`ops/compose/docker-compose.yml` and a stray `ops/docker-compose.yml`). SSOT.

## Decision (target structure)

```
platform/
  packages/                      # ← renamed from engine/; standard Nx/Turbo grouping
    contracts/                   # NEW @statdash/contracts — zero-dep shared types (PageDataSnapshot, manifest, bootstrap DTOs)
    expr/        @statdash/expr     (src/index.ts)
    core/        @statdash/engine   (depends: contracts, expr)
    charts/      @statdash/charts   (depends: contracts, core)
    styles/      @statdash/styles   (zero)
    react/       @statdash/react    (depends: contracts, core, charts, styles)
    plugins/     @statdash/plugins  (depends: contracts, react, core)
    runner/      @statdash/runner   # FUTURE (ADR-0026 trigger) — generic SDUI runner; extract when geostat is its 2nd consumer
  apps/
    api/         @statdash/api      (depends: contracts, core)   Dockerfile at app root ✔
    geostat/     national-accounts  (thin tenant instance of runner; depends: contracts, runner, plugins, styles)
                 Dockerfile + nginx.conf → app root (out of src/)
    panel/       @statdash/panel    (depends: contracts, react, plugins)  Dockerfile → app root
ops/   compose | postgres/migrations | config | scripts | ci   (single docker-compose.yml)
```

Arrow (unchanged semantics, now visible in folders):
`contracts ← expr ← core ← charts ← react ← plugins ← apps` ; `contracts ← api`.

Enforcement: keep `eslint no-restricted-imports` arrow gate (proven); add `contracts` as importable-by-all/imports-nothing. Optionally add tsconfig **project references** so `tsc -b` enforces the same graph (compiler-level, not just lint).

### Reconcile the laws
**Update the laws to match the better structure, not vice-versa.** Rewrite root `CLAUDE.md` Law 3 to `packages/contracts ← packages/expr ← packages/core ← packages/charts ← packages/react ← packages/plugins ← apps/*`. Delete the phantom `src/` / top-level `react/` wording. Rewrite `engine/CLAUDE.md` (mistitled "# packages/") to actually live at `packages/CLAUDE.md`.

### Scope: @geostat → @statdash — DECIDED
Rename all six library packages + api + panel to `@statdash/*`. Keep app dir `apps/geostat` and its package name `national-accounts` (that one IS the tenant). This is a one-way-door for external consumers, so do it BEFORE first external publish (panel is pre-publish — now is the cheapest moment).

## Rejected alternatives

1. **Keep `engine/` + `@geostat/*`, just fix the laws to describe it.** Rejected: ratifies first-tenant erosion at the exact moment (pre-publish) it's cheap to fix, and keeps fighting tool defaults. Bending the doctrine to the violation contradicts Law 7.
2. **Collapse all libraries into one `@statdash/platform` package.** Rejected: destroys the enforced arrow (the whole point), kills tree-shaking, makes the api pull React-graph types. Under-granular.
3. **Adopt Nx/Turborepo build orchestration now.** Rejected (YAGNI): source-condition resolution already gives zero-build DX; Nx is a separate, large migration with its own ADR. The rename is orthogonal and should not be coupled to a build-tool change.

## Migration roadmap (Strangler-Fig, reversible, green-suite-preserving)

Each phase ends green (`pnpm test` + `pnpm lint` + `check-laws`). Reversibility gate = single revert of that phase's alias/path block.

- **Phase 0 — Freeze + baseline.** Snapshot 780-green. No code change. Gate: tag.
- **Phase 1 — `@statdash/contracts` (P0-2).** New `packages/contracts` (zero-dep). Move duplicated boundary types (PageDataSnapshot, bootstrap/provisioning DTOs) there; api + react import from it. Fitness: api still does NOT import `@geostat/react` (existing parity test); types now single-sourced. Reversible: drop package, revert imports.
- **Phase 2 — Dockerfiles/nginx out of src/ (P1-3).** `git mv apps/geostat/src/Dockerfile apps/geostat/Dockerfile` (+ nginx, panel). Update compose build contexts. Fitness: `compose:up` builds. Cheap, isolated, fully reversible.
- **Phase 3 — Resolve workspace:* vs alias (P0-1).** Decide ONE: either make `workspace:*` real (ensure `pnpm install` links `@statdash/*` into node_modules and drop the front aliases per the configs' own TODO) OR drop `workspace:*` and make aliases the declared truth. Pick workspace-real (it's the standard + unblocks isolated package builds). Fitness: clean `pnpm install` from scratch + dev + build all green.
- **Phase 4 — `engine/` → `packages/` (P1-4).** `git mv platform/engine platform/packages`. Update tsconfig `paths`, both vite configs, eslint glob patterns (`engine/**`→`packages/**`), check-laws paths. Mechanical; one commit. Fitness: full suite + lint arrow gate green.
- **Phase 5 — `@geostat/*` → `@statdash/*` (P1-2).** Rename the six lib packages + api + panel scope. Update every `package.json name`, `dependencies`, alias `find`, tsconfig `paths`, imports. Keep `apps/geostat` dir + `national-accounts` name. Fitness: suite + lint + a new fitness test asserting no `@geostat/<lib>` import survives (only `apps/geostat` may use the word geostat). One-way door — do before external publish.
- **Phase 6 — Internal-layout + test convergence (P2-1/2-2/2-3).** Normalize every package to `src/index.ts`; pick inline-colocated tests; delete stray `ops/docker-compose.yml`. Boy-scout, low risk.
- **Phase 7 (FUTURE, gated by ADR-0026) — extract `@statdash/runner`.** When the generic SDUI runner has its 2nd consumer, lift it out of `apps/geostat` into `packages/runner`; geostat becomes a thin instance. Do NOT do speculatively (YAGNI / [[m5-platform-enhancement]] — build the seam when the second caller is real).

## How to apply
Treat Phases 1–5 as the load-bearing restructure; 6–7 are follow-on. Phase 5 (scope rename) is the irreversible one — sequence it before any external panel publish. The arrow eslint gate is the safety net throughout: if a phase lets an inner layer import outward, lint goes red and the phase reverts.

---
name: cluster2-law1-seams
description: CLUSTER② closed — GrowthResolver Law-1 leak killed + 2 declared-but-inert seams honored (available, granularity), all packages/core
metadata:
  type: project
---

CLUSTER② (Law-1 leaks + declared-but-not-honored seams, all `packages/core`) — LANDED, 3 disjoint commits on `feat/tenant-agnostic-platform` (ac64523 / 4bba0a3 / a195a79), each reverts independently. Full-green: build:engine, geostat+panel tsc, eslint, check-laws (17 ✅), core vitest 554/554, second-tenant.fitness 8/8.

**Why:** privileged-name/tenant-field breach in the crown resolver layer + two seams (`available`, `granularity`) that were authorable+persisted but folded nothing (silent no-op class).

**How to apply:** when touching registry resolvers or the time/grain seam, these are now guarded — don't reintroduce.

## Root A — GrowthResolver leak (resolvers.ts multi-code branch)
- `filter: { time: … }` → `filter: { [TIME_DIM]: … }`. KEY INSIGHT: `atTime` is WRONG for an obs-meta lookup — `_observe` (store-impl.ts) filters on `query.filter`, NOT `ctx.dims`. So a time PIN on an obs query must be a **filter key** (TIME_DIM), whereas a `val`/`storeVal` pin uses `atTime` (writes ctx.dims). Two different seams.
- `meta['accountColor']` was **DEAD** — zero growth specs ship in geostat; `accountColor` is a transform-pipe rename the GrowthResolver (reads raw obs) never sees. Generic `meta['color']` only.
- Guard: [[reference_no_privileged_literal_guard]] — FF-NO-PRIVILEGED-LITERAL (registry/no-privileged-literal.fitness.test.ts + check-laws.sh twin).

## AD-6 — PerspectiveDef.available honored
- `perspectiveOptions()` filters offered list by `available` via `evalVisibility` + OPTIONAL `gate` arg. Omitted ⇒ byte-identical (react caller untouched).
- **INCOMPLETE at runtime:** react SiteRenderer.tsx:141 does NOT yet thread `gate` (fr not in scope there). Core capability complete; **runtime activation is a react-lane follow-up** (thread filterParams into perspectiveOptions). Flagged to parent.

## GRAIN-G4 — granularity threaded to point read
- `desugarTimeseries` threads NON-default `timeDimension.granularity` → `point-series.grain[TIME_DIM]`. `DEFAULT_GRANULARITY`/`isDefaultGranularity` in time-dimension.ts (a **constant** — `=== 'year'` literal would trip FF-NO-MODE-LITERAL).
- Annual/default ⇒ no grain ⇒ byte-identical `val` path (setting grain routes storeValAt through the `valAt` port → warm-key change → NOT byte-identical; hence the default-gate is load-bearing, not cosmetic).
- DATA-GATED: no sub-annual dataset / grain-aware store exists → quarter→year roll-up NOT exercised on real data. FF-GRANULARITY-ROLLS-UP proves annual no-op + grain-reaches-valAt-port (spy store). Aggregation is the store's job (`rollupValues` exists). See [[reference_grain_store_port]].

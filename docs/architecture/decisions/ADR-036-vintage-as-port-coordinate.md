---
title: Vintage / Release-Time as a First-Class Port Coordinate
status: Draft (design only; audit gate passed — foundation SOUND)
date: 2026-07-11
authors: platform-architect
related: ADR-0025 (vintage-as-release, DB layer), ADR-034 (semantic query plane), ADR-024 (reactive graph)
spec: docs/architecture/proposals/SPEC-vintage-revision-dimension.md
---

# ADR-036 — Vintage / Release-Time as a First-Class Port Coordinate

**Status:** Draft (design only). Extends ADR-0025 (which modeled vintage at the DB layer) *upward* through the DataStore port, the semantic layer, `extractDeps`, and the Constructor — so vintage becomes expressible as `ctx.dims['vintage']` end-to-end.

## Context

National-accounts data is continuously revised (flash → preliminary → final; benchmark revisions restate history). The frontier capability — which no BI tool ships — is to model **vintage (release-time) as a first-class dimension** so users see "GDP 2020 as known in 2021-Q1 vs latest," revision triangles, and real-time-vs-final analysis (ALFRED/FRED, OECD revision analysis).

An audit of the data foundation (SPEC-vintage-revision-dimension) reached ground truth:
- The DB **already** implements a bitemporal real-time database: `stats.observation` is single-valued-current; V8+V25 preserve every superseded value as a **release-keyed closed validity interval** in the append-only `stats.observation_revision` log. A working **as-of reconstruction** (`queryAsOf`/`buildAsOfSql`) and a **release REST surface** (`releases.ts`) exist.
- Law 1 is honored at the engine: `matchedValues` iterates `ctx.dims` generically; no privileged-time branch.
- `extractDeps` would carry a vintage dim generically with zero new code.

**The mission's core fear — "a revision overwrites the prior value; history is destroyed" — is UNFOUNDED.** The `ON CONFLICT DO UPDATE` overwrite of the current cube is non-destructive because the pre-image capture trigger preserves the old value with its release-keyed interval.

**What is missing is REACH, not integrity:** vintage lives at the DB+REST layer but is not expressible through the DataStore **port**, so the semantic layer, reactive graph, and Constructor cannot treat it as a dimension. Two DB-integrity gates (below) must close first.

## Decision

1. **Vintage is a bitemporal PORT coordinate, not a `dim_key` dimension.** Expose it at the port as a generic peer dim (`ctx.dims['vintage']`), physically realized by the existing as-of overlay — the ALFRED pattern (vintage date = a query dimension over a bitemporally-stored series). This reconciles Law 1 (vintage = a generic peer) with the sound physical model (release + pre-image log). `dim_key` is NOT touched.

2. **Reserved-dim convention `VINTAGE_DIM = 'vintage'`**, the third named SSOT convention the port threads specially — exactly as `TIME_DIM` (→ `from`/`to`) and `MEASURE_DIM` (→ the `val` code axis) already are. `ApiStore` translates a present `vintage` coordinate to `?asOf=<D>` and excludes it from the structural `dim_key` filter; absent/`'latest'` ⇒ byte-identical to today. A `StoreCaps.asOf` capability flag makes vintage-serving introspectable (palette discovery).

3. **Governed `vintage` dimension + `revision` metric** registered in the semantic layer (peers of existing `DimensionDef`/`MetricDef`), so the Constructor surfaces vintage as a filter-bar / perspective-axis and revision as a selectable measure — with **zero new machinery** (existing perspective / filter / metric grammar).

4. **Integrity gates close FIRST (R1, R2)** — see Consequences. The port work builds only on a proven-hole-free, discontinuation-safe timeline.

## Rejected Alternatives

1. **Vintage as a `dim_key` dimension (append a new keyed row per release).** REJECTED. It bloats the hottest table, fights the TimescaleDB partition-key unique constraint and compression, and duplicates the history the V8 pre-image log already holds (ADR-0025 rejected-alt #1, re-affirmed). Vintage is a bitemporal axis, not a structural one.
2. **A `StoreQuery.asOf` field on every query discriminant.** REJECTED. More explicit but duplicated onto every query type, and it does NOT flow through the generic dim machinery — so it would not be Constructor-authorable as a filter/perspective without bespoke wiring. The reserved-dim convention gives that reach for free (maximal decoupling: authored once, orthogonal to every axis).
3. **Build the innovation now on the current writer path (defer the integrity gates).** REJECTED — this is the "don't build on rot" violation. A non-publish writer can revise a value without a release context (R1) → an open-ended pre-image the overlay cannot place; a discontinued series' pre-image `dim_key` is unrecoverable (R2) → it vanishes from as-of reads. The vintage timeline must be provably complete before the port exposes it.

## Consequences

**Positive.** Vintage becomes a first-class, generic, Constructor-authorable dimension end-to-end; revision triangles and real-time-vs-final fall out of the existing grammar. Reuses the sound bitemporal store (no cube duplication). Law-1/2/4/5-clean; dependency arrow intact. Each step is additive and byte-identical when vintage is absent (Strangler-Fig).

**Cost / negative.** Two DB-integrity gates must land first:
- **R1 — release-context on every revision.** Make the ADR-0025 invariant executable (a fitness test that no post-genesis pre-image has NULL `superseded_by_release_id`; optionally a guard trigger rejecting un-released `obs_value` updates). *Designed in ADR-0025 but not found implemented.*
- **R2 — preserve pre-image `dim_key`.** Add `dim_key` (full jsonb) to `stats.observation_revision`, copy `OLD.dim_key` in the capture trigger, and read it in `buildAsOfSql` instead of the fragile `LEFT JOIN` to the (possibly-deleted) live row — so discontinued series remain reconstructable.
- The reserved-dim `?asOf=` wire contract (M1) is a `⛔` boundary other layers bind to — freeze it deliberately.

**Fitness functions (the invariants).**
- `FF-VINTAGE-TIMELINE-COMPLETE` (R1) — no post-genesis pre-image with NULL `superseded_by_release_id`.
- `FF-VINTAGE-DISCONTINUATION-SAFE` (R2) — a discontinued series is reconstructable as-of.
- `FF-VINTAGE-PORT` (M1) — vintage-absent read byte-identical; vintage-present emits `?asOf=` and drops `vintage` from the structural filter.
- `FF-REVISION-METRIC` (M2) — `revision` expands to two vintage-pinned reads; raw-code byte-identical.
- `FF-VINTAGE-DEPS` (M3) — `extractDeps` carries `vintage` generically.

## Files grounded in (read before implementation)
- `ops/postgres/migrations/V4` (observation hypertable + key), `V8` (pre-image log + capture trigger), `V25` (release aggregate + release-keyed intervals + genesis backfill).
- `platform/apps/api/src/ingest/upsert.ts` (the `DO UPDATE` writer), `publish.ts` (`app.release_id` context).
- `platform/apps/api/src/routes/stats/observations.ts` (`queryAsOf`/`buildAsOfSql`, `?asOf=`), `releases.ts` (`GET /:id/observations`).
- `platform/packages/core/src/core/context.ts` (`SectionContext`, `TIME_DIM`/`MEASURE_DIM`), `data/store.ts` (`StoreQuery`/`StoreCaps`), `data/store-api.ts` (wire), `data/store-filter.ts` (`buildObsFilterParam`/`matchedValues`), `data/dimension.ts` + `data/metric.ts` (semantic layer), `graph/extractDeps.ts` (reactive graph).

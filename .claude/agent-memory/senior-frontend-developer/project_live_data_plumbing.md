---
name: live-data-plumbing
description: "Three live-store facts that don't survive a quick code read — live ApiStore does pure dim_key containment with no measure filter (every DataSpec must pin scoping dims itself), the three-layer request-volume bound during live-preview editing, and store-builder classifier region-scoping. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (live-store-measure-pinning,
> live-preview-request-volume, store-cube-region-scoping).

## Live path does NOT filter/aggregate by measure — pin every scoping dim yourself
`packages/plugins/datasources/stats-registrations.ts` → `CachedStore` over `ApiStore` behaves
differently from `ExternalStore` (seed/in-memory):
- `apps/api/src/routes/stats/observations.ts` runs `dim_key @> $filter::jsonb` GIN containment
  with NO aggregation — a query that doesn't pin every non-time dimension fans out one row per
  unmatched-dim combination.
- `ApiStore.toObsParams` builds the route `filter` from `nonTimeDims ∩ ctx.dims` PLUS
  `query.filter` keys only — it NEVER sends `q.measure`/`q.code` to the route and never
  post-filters by measure. `query.measure` is effectively ignored on the live path; scoping is
  done entirely by `filter`.
- KPI `val` reads (`storeVal`) are measure-filtered only by `ExternalStore`. On the live path a
  `val` read returns `rows[0]` of the cached slice REGARDLESS of measure — a point/yoy/cagr KPI
  reads the WRONG row unless `measure` is pinned into `ctx.dims` via `value.filter`/`trend.filter`
  AND `measure` is listed in the dataSource `nonTimeDims`.

**How to apply when authoring against a live `stats` dataSource:**
- Single-value reads (KPIs, single-series charts): pin EVERY non-time dim incl. `measure`.
- Multi-series breakdowns: pin every non-time dim EXCEPT the one you want to vary — the route
  fan-out over that dim IS the series set; use a `lookup {$d:dim}` for labels + `encoding.pct
  {sumOf:'value'}` for share (avoids the unfiltered `pct.of` val lookup too).
- `dataSource.config.nonTimeDims` must list EVERY non-time DSD dim or a ctx.dims pin for an
  unlisted dim never reaches the route filter.
- `obs_attribute` columns (e.g. `contribution_role`) are NOT spread onto the row by
  `fromStatsObsRow` — a derive/filter expr can only reference dims/value/obsStatus, never an
  attribute; negate/flag by measure code instead. See [[project_panel_authoring_features_misc]].

## Live-preview request-volume bound (Constructor canvas editing loop)
Live-store is `ApiStore` (`caps.sync===false`) — async-only stores BYPASS `CachedStore` entirely
in `resolveNodeRows` (`if (raw.caps?.sync===false) return raw`). Two existing caches dedupe
IDENTICAL queries (`ApiStore._cache` keyed on params JSON; `useNodeRows._promiseCache` keyed on
specDimKey, cap 200) but CANNOT collapse the DISTINCT intermediate spec states a keystroke burst
produces. **The only thing that bounds volume across an edit burst is debouncing the page
descriptor** feeding the live renderer: `useDebouncedLivePage(page, mode)` — structural mode is
identity passthrough (instant); live mode publishes the settled page after
`LIVE_PREVIEW_DEBOUNCE_MS` (350ms). Feeds the renderer's Layer 1 only; the overlay (selection/drop)
keeps the live `page` so editing stays responsive. Do NOT add another cache layer — debounce the
descriptor, lean on the two existing identity caches. **Lint gotcha:** the previous-value tracker
is held as STATE (set-state-during-render), not a ref — the panel eslint config forbids
ref-read/write during render AND setState-in-effect.

## Store-builder classifier region-scoping (data-governance flag)
The `stats` store builder constrains each WIRE dim's classifier to the realised member set of the
dataset's cube `actualRegion` (`constrainClassifier`, core `data/codelist.ts` — ancestors kept,
fail-open on a degraded profile). **Why:** the classifier endpoint is dim-GLOBAL but the dev DB's
`sector` dim holds TWO current vocabularies — seed-bundle short codes (facts realise these) AND
numeric-NACE codes (seeded for the canonical-workbook ingest) — so a selector showed every category
twice before scoping. **How to apply:** duplicate/foreign options in ANY dim selector → check the
dim-global codelist vs the dataset's realised region FIRST, never patch the control; options
self-correct if the vocabularies are ever reconciled.

# Static-era regression — the lost logic-driven capability (git-history root cause)

> Read-only archaeology. Scope: the static-file baseline + the causal migration commit.
> The engine-side *effects-retirement mechanism* and the current visual drift are owned by other agents — this report names the **commit that dropped the capability**, not the deletion internals.

---

## (a) The static-era baseline — files, what they did, commit refs

**Snapshot commit:** `191bc0e` *"chore: initial commit — pre-platform migration snapshot"* (root of history). This is the canonical static era. It already contains the config-driven renderer **and** the static assets side by side.

**Static DATA files** (`apps/geostat/src/data/<domain>/`), one bundle per domain (`accounts`, `gdp`, `regional`):
- `raw.ts` — AUTO-GENERATED hardcoded dataset from an `.xlsx` (`REGIONAL_FACTS`, `REGIONAL_CLASSIFIERS`, `REGIONAL_DISPLAY`). Inline `Observation[]` + codelists.
- `adapter.ts` — `fromRegionalFacts()` shaping raw → DataBundle.
- `store.ts` — `new ExternalStore(fromRegionalFacts(REGIONAL_FACTS), { classifiers, display })`. A **synchronous, fully-materialized in-memory store**. All data present at render time.

**Static RENDERING files** (`apps/geostat/src/pages/`), 4 files per page:
- `<page>.config.ts` — the `InnerPageNode` tree (page-header, filter-bar, **mode-bar**, kpi-strip, sections).
- `<page>.sections.ts` / `.kpis.ts` / `.filters.ts` — the section/KPI/filter definitions.

**The effect/variable engine** (`engine/core/src/config/`, moved to `packages/core/` later, still present today):
- `filter-condition.ts` — `Condition`/`WhenMap` + `evalWhen()` (the `showWhen`/`enableWhen` predicate).
- `filter-derive.ts` — `FilterDerive` ops (`find`/`breadcrumbs`/`join-labels`/`if-else`) + `VarMap` (page-level derived variables, `ctx.vars`).
- `filter-eval.ts` / `filter-params.ts` — `computed` (ExprVal from filter params) + **`effects: Effect[]`** + `applyEffects()`.
- `engine/react/src/engine/renderNode.ts` step 0.5 — `visibleWhen` engine-level visibility gate.
- Doc: `docs/architecture/subsystems/22-derive-effects.md` names the three mechanisms — **computed** (filter→dims), **effects** (filter→mutate filter), **derive** (dims+stores→ctx.derived).

## (b) The effect/variable + conditional-render capability, as it existed (quoted, `191bc0e`)

Static-era `regional.filters.ts` — the whole logic-driven surface in one file:
```ts
effects: [
  { when: { mode: 'range' },          set: { year: '', sector: '_T' } },   // enter range → clear year, pin sector
  { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } }, // leave range → clear the span
],
bars: {
  'year-bar':  { showWhen: { mode: { neq: 'range' } }, filters: { … } },   // conditional element visibility
  'range-bar': { showWhen: { mode: 'range' },          filters: { … } },
}
```
`regional.kpis.ts` — the KPI strip renders a **different set** per mode (`mode: 'year'` vs `mode: 'range'`). `regional.config.ts` — `modeOrder: ['year','range']`, a `mode-bar` toggle, mode-keyed `badge: { year, range }`, and `VarMap` (`_geoMode` = `region contains ',' ? 'multi' : 'single'`, `regionObj`, `_pageCrumbs`).

Two distinct powers were bundled here:
1. **Conditional rendering** — `showWhen` / `visibleWhen` / KPI `mode`: which elements appear per state.
2. **Reactive state mutation (`effects`)** — when perspective/param A hits a condition → **set/clear param B**. This is the *logic-driven element change* the owner remembers (toggling range auto-resets the year and pins sector).

## (c) The migration commits — root cause (SHAs)

Two migrations, same evolution:

**Static DATA → config-driven pipeline:** `7a47e5d` *"platform: packages/ restructure, @statdash scope, Constructor MVP"* (2026-06-23) **deleted every `data/<domain>/raw.ts|adapter.ts|store.ts` and `pages/*.ts`**, replacing the synchronous `ExternalStore` with DB provisioning + `DataSpec`/`ApiStore` (later completed by `d26f772`, `0c86578`). This is the "config-driven data pipeline" the owner names. It did **not** by itself drop the conditional capability — condition/derive/effect files survived the move.

**Mode/effects → perspective (the actual regression, 2026-06-27):**
`301eedf`(P0) → `44e9d3d`(P1) → **`684f9b1`(P2 — added `perspective-is/in/not` *visibility* ops only)** → `f6e6380`(P3) → `e5f3b8e`(P4.5) → **`0ea99b6`(P5 — "migrate geostat config onto the perspective seam (byte-identical)")** → `6087b9c`(P5.1 filter `visibleWhen`) → `67370e3`(P5.2 `KpiSpec.mode`→`when`) → `5e281e4`(P6 — retire ALL System A, removes effects' only caller) → **`4ccd042`(delete the effects subsystem wholesale)** → `1b95ba8`.

**Root cause = `0ea99b6` (P5).** The perspective seam it migrated onto (built in P2 `684f9b1`) modeled *only visibility* — `perspective-is/in/not`. It never had an equivalent for reactive cross-filter `effects`. So the "byte-identical" migration silently **narrowed the capability from {conditional visibility + reactive param mutation} → {conditional visibility only}**. The `effects` rules in the geostat config were simply not re-expressed on the new seam. `5e281e4` then removed the last caller and `4ccd042` deleted the now-orphaned `Effect`/`applyEffects`/`FilterSchema.effects` — correctly (dead code), but the deletion is the *symptom*; the capability was already lost at `0ea99b6`.

## (d) Precisely what was lost vs preserved

| Static-era capability | Today (config-driven, `geostat.provisioning.json`) | Status |
|---|---|---|
| `showWhen` (bar visibility) | `visibleWhen: { op: perspective-is }` | **preserved** |
| KPI `mode: 'year'/'range'` | `when: { op: perspective-is }` | **preserved** |
| VarMap derives (`_geoMode`, `regionObj`, `breadcrumbs`, `join-labels`) | present verbatim | **preserved** |
| **`effects` — reactive cross-filter mutation** (`when A → set/clear B`) | **`"effects"` count = 0; `Effect`/`applyEffects` type deleted** | **LOST** |

The one genuinely-absent power: **logic-driven state mutation across a toggle**. A perspective switch now only flips *what is visible*; it no longer *reacts* by resetting/pinning the underlying filter params. Stale params linger hidden across a toggle (year selection persists into range mode; sector is not auto-pinned to `_T`).

## (e) Mapping to the screenshots (`scriness/img*.png`, regional dashboard)

The shots show the regional page in **დინამიკა (range) perspective** — the top-right `წლიური | დინამიკა` toggle is the `perspective-bar`, two year selectors (2010 / 2024 = `fromYear`/`toYear`) are visible, and the KPI strip shows the *range* set (CAGR, 2024, 2010, avg-growth). **The visibility conditional works** — that half survived. What is no longer observable: the *effect* that in the static era fired on entering range (clear `year`, pin `sector:'_T'`) and on leaving it (clear `fromYear`/`toYear`). The toggle is now purely presentational, not logic-driven — exactly the degradation the owner reports.

## (f) Recovery — restore the lost power in TODAY's declarative architecture (not a rollback)

Re-introduce reactive effects as a **first-class, JSON-serializable capability on the perspective/expr seam**, evaluated in the filter-resolution step (the slot the deleted `applyEffects()` occupied), reusing predicates that already exist:

- **Contract:** `effects?: { when: PerspectiveWhen | ExprVal; set: Record<string, ExprVal | null> }[]` on `FilterSchema` (or a `perspective.onEnter` hook). `when` reuses the existing `perspective-is/in/not` ops; `set` uses whitelisted `ExprVal` (already sandboxed, Law 12 — no functions in config).
- **Evaluator:** a pure `applyEffects(effects, params)` re-added to the filter-resolution pass in `SiteRenderer`/`useFilterState`, running after `computed`, mutating only the flat param map — deterministic, serializable, Constructor-authorable (add an "Effects" pane beside the existing "Perspectives" pane, `c152adc`).
- **Why this and not rollback:** it closes the P2 gap at the seam (visibility *and* reactivity become peer perspective capabilities), keeps the config-driven pipeline, and gives new features (dependent selectors, cross-filter cascades) a reusable base — Open/Closed: a new reactive rule = new config, engine unchanged.

**Guard:** the current `check-laws` retirement guards (added by `4ccd042`) forbid the *old* `Effect`/`applyEffects` names — the recovery must land under the perspective vocabulary, or relax those two guards deliberately in the same commit.

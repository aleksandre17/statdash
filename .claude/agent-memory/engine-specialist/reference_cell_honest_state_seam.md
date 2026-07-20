---
name: cell-honest-state-seam
description: Cell/ValueState + storeCell — the interpret-level honest-state seam (AR-52 W1 / PM-1); how no-data/unbound/masked stop being a fabricated 0
metadata:
  type: reference
---

# The honest-state Cell seam (AR-52 W1 · PM-1 · Law 11 "the canvas never lies")

`packages/core/src/data/cell.ts` (new leaf, landed). The SSOT that ends `storeVal(...) ?? 0` collapsing four conditions into `0`.

- **`ValueState`** = `'ok'|'no-data'|'unbound'|'loading'|'error'|'masked'`; **`Cell`** = `{value:number|null, state, status?}`. `value` is `null` for every non-`ok` state (never a fake 0). This is the architect-blessed PM-1 shape — Class-M public API; do NOT deviate without escalating.
- **`storeCell(store,code,ctx):Cell`** is the honest sibling of `storeVal` (which stays byte-identical). Decides: empty code → `unbound` (BEFORE any read); any obs at coord is 'c' → `masked` (value withheld, sum never computed — closes the F7 disclosure hole); obs-scan `[]` AND sum 0 → `no-data`; else `ok(sum)`. **Key insight: the `val` query SUMS matched obs so it cannot separate no-data from a genuine 0 — distinguishing them REQUIRES the obs-existence scan.** A non-zero sum is ALWAYS ok (never hide a real value); obs-scan returns `null` on throw → degrade to `ok(storeVal)`, never a false no-data.
- **`obsAtCoord`** is the ONE generic coordinate-scan (measure × concrete dims, Law 1). `kpi-preliminary.ts`'s `coordIsPreliminary` now composes it (byte-identical) — a cell's state and its preliminary badge derive from the identical slice.
- **Warm-safety:** storeCell's obs read is at the SAME coordinate `extractKpiRequirements` already warms `obs` under (val+obs per req), so warm===render holds — no new cold-read.
- **KPI path:** `data/kpi.ts` `readMeasureCell` (masked contagious across codes; no-data ⟺ all components empty); `resolveValue` returns `{formatted,state,status}` with every numeric formula byte-identical. `KpiDef.state?` (config/kpi.ts) — `ok` elided ⟺ byte-identical stored KpiDef.
- **Consumer:** `plugins/panels/kpi-strip/default/components/KpiStateCard.tsx` renders the declared affordance for a bound card resolved to no-data/masked (distinct from the STATIC `KpiUnboundCard` — measure never chosen). Wired in `KpiStripShell` AFTER interpret (state is only knowable post-read).
- **Left for later (do not build into the void):** chart/table EngineRow `_state` convention (PM-4 typed spine); metric-path masked composition through calc.inputs (PM-4, deferred — a metric value is ok|no-data this wave); loading/error states are grammar-present but the sync interpret path never emits them (async handled upstream by useKpiRows suspend).

- **`storeCellAt`** (LANDED 2026-07-20, cell.ts) — the honest sibling of `storeValAt` (point read at an EXPLICIT `at` coordinate + optional grain/rollup). Default (no grain, sum) delegates to `storeCell` at the merged ctx (full no-data/masked/genuine-0 semantics + cold-degrade to ok); grain/rollup path trusts the store's `valAt` presence (absent row → null). Used by `PointSeriesResolver` gated on `PointSeriesSpec.noData==='null'` (a NEW opt-in field; also on the value-cell `SourceStep` variant). `desugarTimeseries` sets `noData:'null'` (a DISPLAYED timeseries value cell must not fabricate 0 for an absent year); growth's fold LEAVES it absent (its value cell is the YoY tail's intermediate → must stay byte-identical to GrowthResolver's `?? 0`). Default absent/`'zero'` ⇒ byte-identical to raw `storeValAt`. This is the timeseries slice of the deferred ADR-047 Wave B (polarity is opt-IN-to-honest for reversibility; Wave B flips to honest-by-default globally).

Fitness: `data/cell.fitness.test.ts` (FF-CELL-HONEST-STATE) documents the RED (storeVal collapses the four + publishes a confidential 500) and the GREEN. `pipeline-desugar.fitness.test.ts` FF-CANVAS-NEVER-LIES block proves the value-cell fold reads null for an absent coordinate + 0 for a genuine published 0 (both paths byte-identical).
